# Jira Project Key Analysis: SCRUM vs OPAL

**Date:** 2025-11-19  
**Current Project Key:** `SCRUM`  
**Current Format:** `SCRUM-##` (e.g., SCRUM-27, SCRUM-28)

---

## Current Situation

**Project Key:** `SCRUM`  
**Project Name:** `OPAL Project`  
**Issue Format:** `SCRUM-##`

**Examples:**
- `SCRUM-27`: Device Hardware Foundation
- `SCRUM-28`: Firmware Core Services
- `SCRUM-20`: Provision ESP32-C6 OPAL Board

---

## Is "SCRUM-##" a Good Practice?

### ✅ **The Format is Correct**
- `[PROJECT_KEY]-[ISSUE_NUMBER]` is standard Jira format
- Auto-incremented issue numbers are standard
- This part is fine

### ⚠️ **The Project Key "SCRUM" is Problematic**

**Issues with "SCRUM" as project key:**

1. **Not Product-Focused**
   - "SCRUM" is a methodology, not a product name
   - Doesn't identify what the project is about
   - Could be any project using Scrum methodology

2. **Confusing for Stakeholders**
   - External stakeholders won't know what "SCRUM-27" refers to
   - Doesn't communicate the product (OPAL device)
   - Hard to search/filter across multiple projects

3. **Not Scalable**
   - If you have multiple products, "SCRUM" doesn't help distinguish
   - Better: `OPAL-##`, `OPAL-HW-##`, `OPAL-FW-##`

4. **Professional Appearance**
   - Product-focused keys look more professional
   - Better for client-facing reports
   - Clearer in documentation

---

## Best Practices for Project Keys

### **Recommended Format:**
```
[PRODUCT/COMPONENT]-[OPTIONAL_SUFFIX]
```

**Examples:**
- `OPAL` - Main OPAL project
- `OPAL-HW` - Hardware-specific project
- `OPAL-FW` - Firmware-specific project
- `OPAL-BE` - Backend project
- `OPAL-DEV` - Development project

### **Characteristics of Good Project Keys:**

1. ✅ **Product/Component Name** - Identifies what it's about
2. ✅ **Short** - 2-10 characters (easier to type)
3. ✅ **Uppercase** - Standard convention
4. ✅ **No Spaces** - Use hyphens if needed
5. ✅ **Memorable** - Easy to remember and reference

---

## Comparison: SCRUM vs OPAL

| Aspect | SCRUM-## | OPAL-## |
|--------|----------|---------|
| **Clarity** | ❌ Unclear what project | ✅ Clear: OPAL device |
| **Professional** | ⚠️ Generic methodology name | ✅ Product-focused |
| **Searchable** | ❌ Hard to filter by product | ✅ Easy to filter |
| **Stakeholder-Friendly** | ❌ Confusing | ✅ Self-explanatory |
| **Scalable** | ❌ Doesn't scale | ✅ Can add suffixes |

---

## Recommendation

### **Option 1: Keep SCRUM (Pragmatic)**
**Pros:**
- Already established
- Changing project keys is difficult
- Team is used to it
- Works functionally

**Cons:**
- Not ideal for clarity
- Less professional appearance
- Confusing for new team members

**Action:** Keep using `SCRUM-##` but document that it refers to OPAL project

---

### **Option 2: Create New OPAL Project (Ideal)**
**Pros:**
- Clear, product-focused
- Professional appearance
- Better for stakeholders
- Scalable for future projects

**Cons:**
- Need to migrate existing issues
- Some work to set up
- Team needs to adjust

**Action:** 
1. Create new project with key `OPAL`
2. Migrate existing issues (or link them)
3. Archive/close SCRUM project

---

### **Option 3: Hybrid Approach**
**Pros:**
- Keep existing work
- Add new project for clarity
- Gradual transition

**Cons:**
- Two projects to manage
- Some duplication

**Action:**
1. Keep SCRUM for existing work
2. Create OPAL for new work
3. Gradually migrate

---

## Industry Examples

**Good Project Keys:**
- `JIRA` - Atlassian's Jira project
- `CONF` - Confluence project
- `ANDROID` - Android OS project
- `CHROME` - Chrome browser project

**Poor Project Keys:**
- `SCRUM` - Methodology, not product
- `PROJECT1` - Generic, not descriptive
- `TEST` - Too vague
- `DEV` - Doesn't identify what's being developed

---

## Decision Matrix

| Factor | Weight | SCRUM | OPAL |
|--------|--------|-------|------|
| **Clarity** | High | 2/5 | 5/5 |
| **Professional** | High | 2/5 | 5/5 |
| **Ease of Change** | Medium | 5/5 | 2/5 |
| **Team Familiarity** | Medium | 5/5 | 3/5 |
| **Stakeholder Clarity** | High | 2/5 | 5/5 |
| **Total Score** | | **16/25** | **20/25** |

---

## Recommendation for OPAL Project

### **Short Term (Now):**
✅ **Keep `SCRUM-##`** for now
- Already established
- Functional and working
- Team is familiar
- Changing would be disruptive

### **Long Term (Future):**
✅ **Consider migrating to `OPAL-##`** when:
- Project is more mature
- You have time for migration
- Adding new team members
- Client-facing reports become important

### **Best Practice Going Forward:**
✅ **Use product-focused keys for new projects**
- `OPAL` for main project
- `OPAL-HW` for hardware-specific
- `OPAL-FW` for firmware-specific
- etc.

---

## Alternative: Improve Without Changing

If you keep `SCRUM-##`, you can improve clarity by:

1. **Clear Project Name**
   - Project Name: "OPAL Clinical Communications Device"
   - Keep key as SCRUM (for now)

2. **Documentation**
   - Document that SCRUM = OPAL project
   - Include in onboarding materials

3. **Labels/Components**
   - Use labels: `opal`, `hardware`, `firmware`
   - Use components to categorize

4. **Issue Titles**
   - Make issue titles very clear
   - Include "OPAL" in descriptions when needed

---

## Summary

**Current Format `SCRUM-##`:**
- ✅ Format is correct (standard Jira)
- ⚠️ Project key "SCRUM" is not ideal (methodology, not product)
- ✅ Functional and working
- ⚠️ Less clear for stakeholders

**Recommendation:**
- **Keep `SCRUM-##` for now** (pragmatic)
- **Consider `OPAL-##` for future projects** (ideal)
- **Improve clarity through project name and documentation** (immediate)

---

**Last Updated:** 2025-11-19

