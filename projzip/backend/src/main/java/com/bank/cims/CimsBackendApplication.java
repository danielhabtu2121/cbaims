package com.bank.cims;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CimsBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(CimsBackendApplication.class, args);
    }
}
