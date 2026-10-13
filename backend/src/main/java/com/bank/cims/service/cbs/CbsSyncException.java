package com.bank.cims.service.cbs;

public class CbsSyncException extends RuntimeException {
    public enum ErrorCode {
        SOURCE_NOT_AVAILABLE,
        SOURCE_TIMEOUT,
        SOURCE_AUTHENTICATION_ERROR,
        SOURCE_VALIDATION_ERROR,
        SOURCE_DATA_ERROR,
        MAPPING_ERROR,
        PERSISTENCE_ERROR,
        DUPLICATE_SOURCE_RECORD,
        RELATIONSHIP_RESOLUTION_ERROR,
        UNKNOWN_ERROR
    }

    private final ErrorCode errorCode;

    public CbsSyncException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public CbsSyncException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
