package com.bank.cims.service.cbs;

public class CbsSyncException extends RuntimeException {
    public enum ErrorCode {
        SOURCE_NOT_AVAILABLE,
        SOURCE_TIMEOUT,
        SOURCE_AUTHENTICATION_ERROR,
        SOURCE_VALIDATION_ERROR,
        SOURCE_QUERY_FAILED,
        SCHEMA_MISMATCH,
        SOURCE_DATA_ERROR,
        MAPPING_ERROR,
        PERSISTENCE_ERROR,
        DUPLICATE_SOURCE_RECORD,
        RELATIONSHIP_RESOLUTION_ERROR,
        UNKNOWN_ERROR
    }

    private final ErrorCode errorCode;
    private final String failingView;

    public CbsSyncException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.failingView = null;
    }

    public CbsSyncException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.failingView = null;
    }

    public CbsSyncException(ErrorCode errorCode, String message, String failingView) {
        super(message);
        this.errorCode = errorCode;
        this.failingView = failingView;
    }

    public CbsSyncException(ErrorCode errorCode, String message, String failingView, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.failingView = failingView;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public String getFailingView() {
        return failingView;
    }
}
