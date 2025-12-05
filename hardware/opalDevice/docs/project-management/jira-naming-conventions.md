# Jira Work Item Naming Best Practices

**Date:** 2025-11-19  
**Purpose:** Establish consistent naming conventions for OPAL project Jira work items

---

## Core Principles

1. **Action-Oriented**: Use verbs to describe what will be done
2. **Clear & Specific**: Avoid vague terms, be precise
3. **Searchable**: Use keywords that team members will search for
4. **Consistent**: Follow the same pattern across all items
5. **Concise**: Keep titles under 80 characters when possible

---

## Naming Patterns by Issue Type

### **Epics** (Large Bodies of Work)

**Pattern:** `[Noun/Area] [Action/Outcome]`

**Examples:**
- ✅ `Device Hardware Foundation`
- ✅ `Firmware Core Services`
- ✅ `Communication Infrastructure`
- ❌ `Hardware` (too vague)
- ❌ `Work on device hardware and fix I2C issues and audio problems` (too long, not focused)

**Best Practices:**
- Use 2-4 words
- Focus on the area/domain, not the action
- Capitalize each major word (Title Case)
- Avoid "Implement", "Create", "Build" (implied)

---

### **Stories** (User-Facing Features)

**Pattern:** `As a [user], I want [goal] so that [benefit]` (in title)  
**OR** `[User] can [action] [outcome]` (simplified)

**Examples:**
- ✅ `Nurse can switch between targeted and broadcast messaging modes`
- ✅ `Clinician receives contextual call routing based on availability`
- ✅ `Device displays mode indicator so user knows message scope`
- ❌ `Mode switching` (not user-focused)
- ❌ `Fix the UI for messaging` (not outcome-focused)

**Best Practices:**
- Focus on user value, not implementation
- Use active voice ("can", "receives", "displays")
- Include the "why" when space allows
- Start with user role when relevant

---

### **Tasks** (Technical Work Items)

**Pattern:** `[Action Verb] [Object] [Context/Details]`

**Examples:**
- ✅ `Add I2C pull-up resistors to GPIO7/8`
- ✅ `Configure AEC for 16kHz sample rate`
- ✅ `Design device-to-backend API specification`
- ✅ `Document current hardware stack and limitations`
- ❌ `I2C fix` (too vague)
- ❌ `Work on audio` (not specific)
- ❌ `Fix the thing that's broken` (not descriptive)

**Best Practices:**
- Start with action verb (Add, Configure, Design, Document, Fix, Implement, Test, etc.)
- Be specific about what and where
- Include technical details when relevant (GPIO pins, sample rates, etc.)
- Use present tense or imperative mood

---

### **Bugs** (Defects)

**Pattern:** `[Component] [Issue Description] [Context]`

**Examples:**
- ✅ `Audio codec fails to initialize when I2C pull-ups missing`
- ✅ `AEC error when sample rate not 16kHz`
- ✅ `Touch screen unresponsive after device sleep`
- ❌ `Audio broken` (not specific)
- ❌ `Bug in codec` (doesn't describe the issue)

**Best Practices:**
- Include component name
- Describe the symptom/error
- Include conditions when relevant
- Be specific about failure mode

---

## OPAL Project-Specific Conventions

### **Component Prefixes** (Optional, for clarity)

When helpful, prefix with component:
- `[HW]` - Hardware
- `[FW]` - Firmware
- `[API]` - Backend API
- `[AI]` - AI/LLM features
- `[UX]` - User experience
- `[DOC]` - Documentation

**Examples:**
- `[HW] Add I2C pull-up resistors to GPIO7/8`
- `[FW] Configure AEC for 16kHz sample rate`
- `[API] Design device-to-backend REST API`

**Note:** Use sparingly - only when it adds clarity. Don't over-prefix.

---

### **Priority/Urgency Indicators** (In description, not title)

Don't put priority in title. Use Jira priority field instead.

- ❌ `[URGENT] Fix I2C communication`
- ✅ `Fix I2C communication` (set Priority = Highest in Jira)

---

### **Status Indicators** (Don't use in titles)

Don't include status in title - Jira tracks this.

- ❌ `[DONE] Provision ESP32-C6 board`
- ❌ `[IN PROGRESS] Audio pipeline debugging`
- ✅ `Provision ESP32-C6 board` (status tracked in Jira)

---

## Common Mistakes to Avoid

### ❌ **Too Vague**
- `Hardware work`
- `Fix bugs`
- `Improve system`

### ❌ **Too Long**
- `Implement the device hardware foundation including ESP32-C6 board provisioning, I2C hardware fixes with pull-up resistors, audio system debugging, PCB design and production roadmap, and comprehensive hardware testing and validation`

### ❌ **Implementation Details in Story Titles**
- `Add mode switching button to UI` (this is a task, not a story)
- Better: `Nurse can switch between targeted and broadcast messaging modes`

### ❌ **Redundant Words**
- `Implement implementation of...`
- `Create creation of...`
- `Fix fix for...`

### ❌ **Ambiguous Pronouns**
- `Fix it` (what is "it"?)
- `Update the thing` (what thing?)

---

## Examples for OPAL Project

### **Epics** (Current - Good Examples)
- ✅ `Device Hardware Foundation`
- ✅ `Firmware Core Services`
- ✅ `Communication Infrastructure`
- ✅ `AI-Enhanced Communications`

### **Stories** (Good Examples)
- ✅ `Nurse can switch between targeted and broadcast messaging modes`
- ✅ `Clinician receives smart call routing based on EMR schedule`
- ✅ `Device displays mode indicator so user knows message scope`
- ✅ `Nurse can use voice commands for hands-free operation`

### **Tasks** (Good Examples)
- ✅ `Add I2C pull-up resistors to GPIO7/8`
- ✅ `Configure AEC for 16kHz sample rate`
- ✅ `Design device-to-backend REST API specification`
- ✅ `Document current hardware stack and limitations`
- ✅ `Build mock paging server for demos`
- ✅ `Implement Contextual Router MVP`

### **Bugs** (Good Examples)
- ✅ `Audio codec fails to initialize when I2C pull-ups missing`
- ✅ `AEC error "Only support 16K sample rate" with 8kHz config`
- ✅ `Touch screen unresponsive after device sleep mode`

---

## Searchability Tips

### **Use Keywords People Will Search For**
- Include component names: `I2C`, `AEC`, `ES8311`, `ESP32-C6`
- Include technical terms: `pull-up`, `sample rate`, `codec`, `VoIP`
- Include workflow terms: `mode switching`, `broadcast`, `targeted`
- Include department names when relevant: `ER`, `Pharmacy`, `MedSurg`

### **Examples:**
- ✅ `Add I2C pull-up resistors to GPIO7/8` (searchable: "I2C", "pull-up", "GPIO")
- ✅ `Configure AEC for 16kHz sample rate` (searchable: "AEC", "16kHz", "sample rate")
- ❌ `Fix audio thing` (not searchable)

---

## Consistency Checklist

When creating a new work item, ask:

1. ✅ **Is it action-oriented?** (Does it start with a verb or describe an outcome?)
2. ✅ **Is it specific?** (Could someone understand what needs to be done?)
3. ✅ **Is it searchable?** (Would team members find it if searching for related terms?)
4. ✅ **Is it consistent?** (Does it follow the same pattern as similar items?)
5. ✅ **Is it concise?** (Can it be understood at a glance?)

---

## Quick Reference

| Issue Type | Pattern | Example |
|------------|---------|---------|
| **Epic** | `[Area] [Outcome]` | `Device Hardware Foundation` |
| **Story** | `[User] can [action] [outcome]` | `Nurse can switch messaging modes` |
| **Task** | `[Action] [Object] [Details]` | `Add I2C pull-up resistors to GPIO7/8` |
| **Bug** | `[Component] [Issue] [Context]` | `Audio codec fails when I2C missing` |

---

## Implementation

1. **Review existing items** - Update any that don't follow conventions
2. **Use as template** - Reference this doc when creating new items
3. **Team alignment** - Share with team for consistency
4. **Iterate** - Refine conventions based on team feedback

---

**Last Updated:** 2025-11-19

