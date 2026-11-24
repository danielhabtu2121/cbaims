package com.bank.cims.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> badRequest(IllegalArgumentException e){
        if (e.getMessage() != null && e.getMessage().toLowerCase().contains("access denied")) {
            return build(HttpStatus.FORBIDDEN, e.getMessage());
        }
        return build(HttpStatus.BAD_REQUEST,e.getMessage());
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String,Object>> conflict(IllegalStateException e){return build(HttpStatus.CONFLICT,e.getMessage());}

    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String,Object>> missingParameter(org.springframework.web.bind.MissingServletRequestParameterException e){
        return build(HttpStatus.BAD_REQUEST, "Required parameter '" + e.getParameterName() + "' is missing.");
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String,Object>> typeMismatch(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException e){
        return build(HttpStatus.BAD_REQUEST, "Invalid value for parameter '" + e.getName() + "'.");
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String,Object>> unreadableBody(org.springframework.http.converter.HttpMessageNotReadableException e){
        return build(HttpStatus.BAD_REQUEST, "The request body could not be read. Check the JSON format and required fields.");
    }
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> generic(Exception e){
        log.error("Unhandled exception caught by GlobalExceptionHandler: ", e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,"The operation could not be completed: " + e.getMessage());
    }
    private ResponseEntity<Map<String,Object>> build(HttpStatus status,String message){Map<String,Object> m=new LinkedHashMap<>();m.put("timestamp", LocalDateTime.now().toString());m.put("status",status.value());m.put("error",message==null?status.getReasonPhrase():message);return ResponseEntity.status(status).body(m);}
}
