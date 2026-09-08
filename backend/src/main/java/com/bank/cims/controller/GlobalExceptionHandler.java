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
    public ResponseEntity<Map<String,Object>> badRequest(IllegalArgumentException e){return build(HttpStatus.BAD_REQUEST,e.getMessage());}
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String,Object>> conflict(IllegalStateException e){return build(HttpStatus.CONFLICT,e.getMessage());}
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> generic(Exception e){return build(HttpStatus.INTERNAL_SERVER_ERROR,"The operation could not be completed. Please review the server log for details.");}
    private ResponseEntity<Map<String,Object>> build(HttpStatus status,String message){Map<String,Object> m=new LinkedHashMap<>();m.put("timestamp", LocalDateTime.now().toString());m.put("status",status.value());m.put("error",message==null?status.getReasonPhrase():message);return ResponseEntity.status(status).body(m);}
}
