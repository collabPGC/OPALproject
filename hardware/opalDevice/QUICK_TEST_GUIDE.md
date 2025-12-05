# Quick Test Guide - ESP32-C6 OPAL

## Quick Test Commands

### **1. Test Board Configuration**
```powershell
powershell -ExecutionPolicy Bypass -File test_board_config.ps1
```

### **2. Test VoIP Files**
```powershell
powershell -ExecutionPolicy Bypass -File test_voip_integration.ps1
```

### **3. Test AEC Project Setup**
```powershell
powershell -ExecutionPolicy Bypass -File test_aec_build.ps1
```

### **4. Run All Tests**
```powershell
powershell -ExecutionPolicy Bypass -File run_all_tests.ps1
```

---

## Build Test (Requires ESP-IDF Environment)

### **Activate ESP-IDF**:
```powershell
. C:\Users\huber\esp\v5.5.1\esp-idf\export.ps1
```

### **Set Environment Variables**:
```powershell
$env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
$env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"
```

### **Build AEC Project**:
```powershell
cd esp-adf-temp\examples\advanced_examples\aec
idf.py set-target esp32c6
idf.py menuconfig  # Select ESP32-C6-OPAL board
idf.py build
idf.py -p COM4 flash monitor
```

---

## Expected Results

✅ **All test scripts**: Should show "PASSED"  
✅ **Build**: Should complete without errors  
✅ **Runtime**: Should show correct pinout in logs  

---

**See TEST_RESULTS.md for detailed results**

