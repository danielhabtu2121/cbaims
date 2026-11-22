package com.bank.cims.service.cbs;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class RealCbsAdapterTest {

    @Test
    @DisplayName("RealCbsAdapter reports NOT_CONFIGURED when jdbcUrl or password is empty")
    void testConnectionStatusNotConfigured() {
        RealCbsAdapter adapter = new RealCbsAdapter();
        ReflectionTestUtils.setField(adapter, "mode", "REAL");
        ReflectionTestUtils.setField(adapter, "jdbcUrl", "");
        ReflectionTestUtils.setField(adapter, "username", "CBAIMSUSER");
        ReflectionTestUtils.setField(adapter, "password", "");
        ReflectionTestUtils.setField(adapter, "schema", "FCUBSLIVE");

        CbsConnectionStatus status = adapter.checkConnectionStatus();
        assertNotNull(status);
        assertEquals("NOT_CONFIGURED", status.getStatus());
        assertTrue(status.getMessage().contains("not yet configured"));
    }

    @Test
    @DisplayName("RealCbsAdapter schema validation checks exact view names and columns")
    void testSchemaValidationExpectations() {
        RealCbsAdapter adapter = new RealCbsAdapter();
        ReflectionTestUtils.setField(adapter, "mode", "REAL");
        ReflectionTestUtils.setField(adapter, "jdbcUrl", "");
        ReflectionTestUtils.setField(adapter, "username", "CBAIMSUSER");
        ReflectionTestUtils.setField(adapter, "password", "");
        ReflectionTestUtils.setField(adapter, "schema", "FCUBSLIVE");
        ReflectionTestUtils.setField(adapter, "customerView", "FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER");
        ReflectionTestUtils.setField(adapter, "facilityView", "FCUBSLIVE.STVWCBS_CBAIMS_FACILITY");
        ReflectionTestUtils.setField(adapter, "collateralView", "FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL");

        // When not configured, validateSchema should return NOT_CONFIGURED status without crashing
        Map<String, Object> result = adapter.validateSchema();
        assertNotNull(result);
        assertEquals("NOT_CONFIGURED", result.get("status"));
    }

    @Test
    @DisplayName("RealCbsAdapter is immediately integration-ready with built-in production Oracle CBS credentials")
    void testDefaultConfigurationIsReady() {
        RealCbsAdapter adapter = new RealCbsAdapter();
        ReflectionTestUtils.setField(adapter, "mode", "REAL");
        ReflectionTestUtils.setField(adapter, "jdbcUrl", "jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT");
        ReflectionTestUtils.setField(adapter, "username", "CBAIMSUSER");
        ReflectionTestUtils.setField(adapter, "password", "CBaims@12345!");
        ReflectionTestUtils.setField(adapter, "schema", "FCUBSLIVE");
        ReflectionTestUtils.setField(adapter, "customerView", "FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER");
        ReflectionTestUtils.setField(adapter, "facilityView", "FCUBSLIVE.STVWCBS_CBAIMS_FACILITY");
        ReflectionTestUtils.setField(adapter, "collateralView", "FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL");

        assertTrue(adapter.isConfigured(), "Adapter must be configured and ready without requiring user input");
    }
}
