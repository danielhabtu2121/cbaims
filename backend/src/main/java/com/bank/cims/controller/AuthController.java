package com.bank.cims.controller;

import com.bank.cims.model.User;
import com.bank.cims.repository.UserRepository;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.ConfigurationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins="*")
public class AuthController {
    @Autowired private UserRepository userRepository;
    @Autowired private CimsService cimsService;
    @Autowired private ConfigurationService configurationService;

    @PostMapping("/login")
    public ResponseEntity<Map<String,Object>> login(@RequestBody Map<String,String> credentials){
        String username=credentials.get("username"), password=credentials.get("password");
        if(username==null||password==null)return ResponseEntity.badRequest().body(Map.of("success",false,"message","Username and password are required."));
        Optional<User> opt=userRepository.findByUsername(username.trim());
        if(opt.isEmpty())return ResponseEntity.status(401).body(Map.of("success",false,"message","Invalid username or password."));
        User user=opt.get();
        if(!user.isActive())return ResponseEntity.status(403).body(Map.of("success",false,"message","Account is inactive. Please contact the System Administrator."));
        if(!passwordMatches(user,password))return ResponseEntity.status(401).body(Map.of("success",false,"message","Invalid username or password."));
        Map<String,Object> response=new LinkedHashMap<>(); response.put("success",true); response.put("token","cims-session-"+user.getId()); response.put("user",safeUser(user));
        cimsService.logAudit(user.getId(),user.getRole(),"USER_LOGIN","User",user.getId(),"Session","LoggedOut","LoggedIn","Successful user login");
        return ResponseEntity.ok(response);
    }

    private boolean passwordMatches(User user,String supplied){
        // The simulator database contains plain development passwords. Preserve compatibility until a real identity provider is connected.
        return supplied.equals(user.getPassword());
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String,Object>> changePassword(@RequestBody Map<String,String> payload){
        String userId=payload.get("userId"), newPassword=payload.get("newPassword");
        if(userId==null||newPassword==null)return ResponseEntity.badRequest().body(Map.of("success",false,"message","User ID and new password are required."));
        if(newPassword.length()<configurationService.getInt("password_min_length",8))return ResponseEntity.badRequest().body(Map.of("success",false,"message","Password does not meet the configured minimum length."));
        if(configurationService.getBoolean("password_require_special",true)&&!newPassword.matches(".*[^A-Za-z0-9].*"))return ResponseEntity.badRequest().body(Map.of("success",false,"message","Password must contain at least one special character."));
        Optional<User> opt=userRepository.findById(userId);
        if(opt.isEmpty())return ResponseEntity.badRequest().body(Map.of("success",false,"message","User not found."));
        User u=opt.get(); u.setPassword(newPassword); userRepository.save(u);
        cimsService.logAudit(userId,u.getRole(),"CHANGE_PASSWORD","User",userId,"Password","***","***","Password changed successfully");
        return ResponseEntity.ok(Map.of("success",true,"message","Password updated successfully."));
    }

    private Map<String,Object> safeUser(User u){
        Map<String,Object> m=new LinkedHashMap<>(); m.put("id",u.getId());m.put("username",u.getUsername());m.put("fullName",u.getFullName());m.put("email",u.getEmail());m.put("phone",u.getPhone());m.put("role",u.getRole());m.put("branch",u.getBranch());m.put("segment",u.getSegment());m.put("active",u.isActive());return m;
    }
}
