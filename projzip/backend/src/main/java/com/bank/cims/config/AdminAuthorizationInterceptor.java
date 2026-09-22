package com.bank.cims.config;

import com.bank.cims.model.User;
import com.bank.cims.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

@Component
public class AdminAuthorizationInterceptor implements HandlerInterceptor {
    @Autowired private UserRepository userRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if(!request.getRequestURI().startsWith("/api/admin/")) return true;
        if(HttpMethod.OPTIONS.matches(request.getMethod())) return true;
        if(HttpMethod.GET.matches(request.getMethod()) || request.getRequestURI().endsWith("/health") || request.getRequestURI().endsWith("/health/dependencies") || request.getRequestURI().endsWith("/runtime") || request.getRequestURI().endsWith("/configuration-usage") || request.getRequestURI().contains("/calendar/check") || request.getRequestURI().contains("/calendar/add-working-days")) return true;
        if(request.getRequestURI().endsWith("/templates/preview") || request.getRequestURI().endsWith("/templates/validate")) return true;

        String claimed=request.getHeader("X-User-Id");
        if(claimed==null||claimed.isBlank()) claimed=request.getParameter("userId");
        if(claimed==null||claimed.isBlank()) claimed=request.getParameter("adminUserId");
        User user=findUser(claimed);
        if(user==null||!user.isActive()||!"SYSADMIN".equalsIgnoreCase(user.getRole())){
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"System Administrator authorization is required for this operation.\"}");
            return false;
        }
        return true;
    }

    private User findUser(String value){
        if(value==null)return null;
        String v=value.trim();
        Optional<User> byId=userRepository.findById(v); if(byId.isPresent())return byId.get();
        Optional<User> byUsername=userRepository.findByUsername(v); if(byUsername.isPresent())return byUsername.get();
        if(v.endsWith("_user")){
            byUsername=userRepository.findByUsername(v.substring(0,v.length()-5)); if(byUsername.isPresent())return byUsername.get();
        }
        if(v.equalsIgnoreCase("SYSADMIN"))return userRepository.findByUsername("sysadmin").orElse(null);
        return null;
    }
}
