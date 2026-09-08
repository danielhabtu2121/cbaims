@echo off
echo Starting CIMS Spring Boot Backend...
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot
set Path=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot\bin;C:\tools\apache-maven-3.9.16\bin;%Path%
cd /d "%~dp0backend"
java -jar "target\cims-backend-0.0.1-SNAPSHOT.jar" --spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration
pause
