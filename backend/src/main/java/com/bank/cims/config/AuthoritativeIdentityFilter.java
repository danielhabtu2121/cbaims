package com.bank.cims.config;

import com.bank.cims.model.User;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Forces caller-supplied actor identity fields to the user resolved from the
 * verified token by {@link SecurityAuthenticationInterceptor}.
 *
 * <p>Legacy endpoints still expose {@code userId}, {@code X-User-Id} and similar
 * parameters. Those values are now ignored for actor/permission decisions: the
 * wrapper returns the authenticated database user instead. Target identifiers
 * (for example a user being administered or an audit subject) are untouched;
 * audit lookup paths are excluded entirely.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AuthoritativeIdentityFilter implements Filter {

    private static final Set<String> ACTOR_PARAMETERS = Set.of(
            "userid", "user_id", "adminuserid", "makerid", "actorid", "requestedby"
    );

    private static final Set<String> ACTOR_HEADERS = Set.of(
            "x-user-id", "x-user", "x-actor-id", "x-requested-by"
    );

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest httpRequest)) {
            chain.doFilter(request, response);
            return;
        }

        String uri = httpRequest.getRequestURI();
        if (!uri.startsWith("/api/") || uri.startsWith("/api/audit/")) {
            chain.doFilter(request, response);
            return;
        }

        chain.doFilter(new AuthoritativeIdentityRequestWrapper(httpRequest), response);
    }

    private static String authenticatedUsername(HttpServletRequest request) {
        Object attribute = request.getAttribute("authenticatedUser");
        if (attribute instanceof User user
                && user.getUsername() != null
                && !user.getUsername().isBlank()) {
            return user.getUsername();
        }
        return null;
    }

    private static boolean isActorParameter(String name) {
        return name != null && ACTOR_PARAMETERS.contains(name.toLowerCase(Locale.ROOT));
    }

    private static boolean isActorHeader(String name) {
        return name != null && ACTOR_HEADERS.contains(name.toLowerCase(Locale.ROOT));
    }

    private static final class AuthoritativeIdentityRequestWrapper extends HttpServletRequestWrapper {

        private AuthoritativeIdentityRequestWrapper(HttpServletRequest request) {
            super(request);
        }

        @Override
        public String getParameter(String name) {
            String actor = authenticatedUsername(this);
            if (actor != null && isActorParameter(name)) return actor;
            return super.getParameter(name);
        }

        @Override
        public String[] getParameterValues(String name) {
            String actor = authenticatedUsername(this);
            if (actor != null && isActorParameter(name)) return new String[]{actor};
            return super.getParameterValues(name);
        }

        @Override
        public Map<String, String[]> getParameterMap() {
            Map<String, String[]> source = super.getParameterMap();
            Map<String, String[]> result = new LinkedHashMap<>(source);
            String actor = authenticatedUsername(this);
            if (actor != null) {
                for (String key : source.keySet()) {
                    if (isActorParameter(key)) {
                        result.put(key, new String[]{actor});
                    }
                }
            }
            return Collections.unmodifiableMap(result);
        }

        @Override
        public String getHeader(String name) {
            String actor = authenticatedUsername(this);
            if (actor != null && isActorHeader(name)) return actor;
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            String actor = authenticatedUsername(this);
            if (actor != null && isActorHeader(name)) {
                return Collections.enumeration(Collections.singletonList(actor));
            }
            return super.getHeaders(name);
        }
    }
}
