"""
Hospital Directory and Callee Lookup System

Provides comprehensive staff and extension lookup:
- Search by name, department, role
- Extension/SIP URI resolution
- Presence and availability status
- On-call schedule integration
- Emergency contact routing

@version 1.0
@date 2025-11-17
@author OPAL Project Team
"""

import asyncio
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, time

logger = logging.getLogger(__name__)


class StaffRole(Enum):
    """Staff roles"""
    NURSE = "nurse"
    DOCTOR = "doctor"
    RESIDENT = "resident"
    PHYSICIAN_ASSISTANT = "physician_assistant"
    NURSE_PRACTITIONER = "nurse_practitioner"
    TECHNICIAN = "technician"
    THERAPIST = "therapist"
    PHARMACIST = "pharmacist"
    SOCIAL_WORKER = "social_worker"
    ADMIN = "admin"


class AvailabilityStatus(Enum):
    """Availability statuses"""
    AVAILABLE = "available"
    BUSY = "busy"
    IN_CALL = "in_call"
    IN_PROCEDURE = "in_procedure"
    ON_BREAK = "on_break"
    OFF_DUTY = "off_duty"
    EMERGENCY_ONLY = "emergency_only"


@dataclass
class ContactMethod:
    """Contact method information"""
    type: str  # "sip", "phone", "pager", "mobile"
    value: str  # URI or number
    priority: int = 1  # Lower = higher priority
    available_247: bool = False


@dataclass
class StaffMember:
    """Staff member directory entry"""
    staff_id: str
    first_name: str
    last_name: str
    role: StaffRole
    department: str
    specialty: Optional[str] = None
    title: Optional[str] = None

    # Contact information
    sip_uri: Optional[str] = None
    extension: Optional[str] = None
    pager_number: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None

    # All contact methods (sorted by priority)
    contact_methods: List[ContactMethod] = field(default_factory=list)

    # Availability
    current_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    status_message: Optional[str] = None
    last_seen: Optional[datetime] = None

    # Schedule
    on_call: bool = False
    on_call_until: Optional[datetime] = None
    shift_end: Optional[datetime] = None

    # Location
    current_location: Optional[str] = None
    home_department: Optional[str] = None

    # Metadata
    languages: List[str] = field(default_factory=lambda: ["en"])
    certifications: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)


@dataclass
class Department:
    """Department information"""
    dept_id: str
    name: str
    main_extension: str
    location: str
    manager_id: Optional[str] = None
    staff_count: int = 0


class CalleeLookupSystem:
    """
    Comprehensive hospital directory and callee lookup system.
    """

    def __init__(self, sip_domain: str = "hospital.local"):
        self.sip_domain = sip_domain

        # Directory database
        self.staff_directory: Dict[str, StaffMember] = {}
        self.departments: Dict[str, Department] = {}

        # Indexes for fast lookup
        self.name_index: Dict[str, List[str]] = {}
        self.department_index: Dict[str, List[str]] = {}
        self.role_index: Dict[str, List[str]] = {}

        # Load directory
        self._load_directory()

        # Statistics
        self.stats = {
            "total_staff": len(self.staff_directory),
            "total_departments": len(self.departments),
            "lookup_count": 0,
            "cache_hits": 0,
        }

        logger.info(
            f"Callee lookup system initialized "
            f"({self.stats['total_staff']} staff, "
            f"{self.stats['total_departments']} departments)"
        )

    async def search_by_name(self, name: str, limit: int = 10) -> List[StaffMember]:
        """
        Search staff directory by name.

        Args:
            name: Search query (first name, last name, or full name)
            limit: Maximum results to return

        Returns:
            List of matching staff members
        """
        name_lower = name.lower()
        results = []

        logger.info(f"Searching directory for: {name}")

        for staff in self.staff_directory.values():
            full_name = f"{staff.first_name} {staff.last_name}".lower()

            if (
                name_lower in staff.first_name.lower()
                or name_lower in staff.last_name.lower()
                or name_lower in full_name
            ):
                results.append(staff)

            if len(results) >= limit:
                break

        # Sort by relevance (exact match first)
        results.sort(
            key=lambda s: (
                not s.first_name.lower().startswith(name_lower),
                not s.last_name.lower().startswith(name_lower),
                len(s.first_name) + len(s.last_name),
            )
        )

        self.stats["lookup_count"] += 1

        logger.info(f"Found {len(results)} matches for '{name}'")

        return results

    async def search_by_department(
        self, department: str
    ) -> List[StaffMember]:
        """Get all staff in a department."""
        results = [
            staff
            for staff in self.staff_directory.values()
            if staff.department.lower() == department.lower()
        ]

        self.stats["lookup_count"] += 1

        return results

    async def search_by_role(self, role: StaffRole) -> List[StaffMember]:
        """Get all staff with a specific role."""
        results = [
            staff for staff in self.staff_directory.values() if staff.role == role
        ]

        return results

    async def search_available_staff(
        self,
        department: Optional[str] = None,
        role: Optional[StaffRole] = None,
    ) -> List[StaffMember]:
        """Get list of currently available staff."""
        available_statuses = {AvailabilityStatus.AVAILABLE}

        results = [
            staff
            for staff in self.staff_directory.values()
            if staff.current_status in available_statuses
            and (not department or staff.department == department)
            and (not role or staff.role == role)
        ]

        return results

    async def get_on_call_staff(
        self, department: Optional[str] = None
    ) -> List[StaffMember]:
        """Get list of on-call staff."""
        now = datetime.now()

        results = [
            staff
            for staff in self.staff_directory.values()
            if staff.on_call
            and (not staff.on_call_until or staff.on_call_until > now)
            and (not department or staff.department == department)
        ]

        return results

    async def lookup_by_extension(self, extension: str) -> Optional[StaffMember]:
        """Look up staff member by extension number."""
        for staff in self.staff_directory.values():
            if staff.extension == extension:
                return staff

        return None

    async def lookup_by_sip_uri(self, sip_uri: str) -> Optional[StaffMember]:
        """Look up staff member by SIP URI."""
        for staff in self.staff_directory.values():
            if staff.sip_uri == sip_uri:
                return staff

        return None

    async def get_contact_uri(
        self, staff_id: str, prefer_sip: bool = True
    ) -> Optional[str]:
        """
        Get best contact URI for staff member.

        Args:
            staff_id: Staff identifier
            prefer_sip: Prefer SIP URI over other methods

        Returns:
            Contact URI or None
        """
        staff = self.staff_directory.get(staff_id)

        if not staff:
            return None

        # If SIP preferred and available
        if prefer_sip and staff.sip_uri:
            return staff.sip_uri

        # Otherwise, use highest priority contact method
        if staff.contact_methods:
            sorted_methods = sorted(staff.contact_methods, key=lambda m: m.priority)
            return sorted_methods[0].value

        # Fallback to extension
        if staff.extension:
            return f"sip:{staff.extension}@{self.sip_domain}"

        return None

    async def get_emergency_contacts(
        self, emergency_type: str = "code_blue"
    ) -> List[StaffMember]:
        """
        Get emergency response team contacts.

        Args:
            emergency_type: Type of emergency

        Returns:
            List of emergency responder staff
        """
        # In production, this would query emergency team assignments

        # For now, return on-call doctors and nurses
        doctors = await self.search_available_staff(role=StaffRole.DOCTOR)
        nurses = await self.search_available_staff(role=StaffRole.NURSE)

        return doctors[:2] + nurses[:3]  # Top 2 doctors + 3 nurses

    async def update_status(
        self,
        staff_id: str,
        status: AvailabilityStatus,
        message: Optional[str] = None,
        location: Optional[str] = None,
    ) -> bool:
        """
        Update staff member's availability status.

        Args:
            staff_id: Staff identifier
            status: New status
            message: Optional status message
            location: Optional location update

        Returns:
            True if successful
        """
        staff = self.staff_directory.get(staff_id)

        if not staff:
            return False

        logger.info(
            f"Status update: {staff.first_name} {staff.last_name} "
            f"-> {status.value}"
        )

        staff.current_status = status
        staff.status_message = message
        staff.last_seen = datetime.now()

        if location:
            staff.current_location = location

        return True

    async def get_department_info(self, dept_id: str) -> Optional[Department]:
        """Get department information."""
        return self.departments.get(dept_id)

    async def list_departments(self) -> List[Department]:
        """List all departments."""
        return list(self.departments.values())

    def get_statistics(self) -> Dict:
        """Get system statistics."""
        # Count available staff
        available_count = sum(
            1
            for staff in self.staff_directory.values()
            if staff.current_status == AvailabilityStatus.AVAILABLE
        )

        # Count on-call staff
        on_call_count = sum(
            1 for staff in self.staff_directory.values() if staff.on_call
        )

        return {
            **self.stats,
            "available_staff": available_count,
            "on_call_staff": on_call_count,
        }

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _load_directory(self):
        """Load staff directory (sample data)."""
        # In production, load from database/LDAP/Active Directory

        # Sample staff members
        staff_data = [
            {
                "staff_id": "nurse101",
                "first_name": "Jane",
                "last_name": "Doe",
                "role": StaffRole.NURSE,
                "department": "Emergency",
                "extension": "5101",
                "title": "RN",
            },
            {
                "staff_id": "doc205",
                "first_name": "John",
                "last_name": "Smith",
                "role": StaffRole.DOCTOR,
                "department": "Cardiology",
                "specialty": "Cardiology",
                "extension": "5205",
                "title": "MD",
            },
            {
                "staff_id": "nurse102",
                "first_name": "Maria",
                "last_name": "Garcia",
                "role": StaffRole.NURSE,
                "department": "ICU",
                "extension": "5102",
                "title": "RN, BSN",
            },
            {
                "staff_id": "doc301",
                "first_name": "David",
                "last_name": "Chen",
                "role": StaffRole.DOCTOR,
                "department": "Emergency",
                "specialty": "Emergency Medicine",
                "extension": "5301",
                "title": "MD",
            },
            {
                "staff_id": "pharm401",
                "first_name": "Sarah",
                "last_name": "Johnson",
                "role": StaffRole.PHARMACIST,
                "department": "Pharmacy",
                "extension": "5401",
                "title": "PharmD",
            },
        ]

        for data in staff_data:
            staff_id = data["staff_id"]
            extension = data.get("extension")

            staff = StaffMember(
                staff_id=staff_id,
                first_name=data["first_name"],
                last_name=data["last_name"],
                role=data["role"],
                department=data["department"],
                specialty=data.get("specialty"),
                title=data.get("title"),
                extension=extension,
                sip_uri=f"sip:{extension}@{self.sip_domain}" if extension else None,
                current_status=AvailabilityStatus.AVAILABLE,
                contact_methods=[
                    ContactMethod(
                        type="sip",
                        value=f"sip:{extension}@{self.sip_domain}",
                        priority=1,
                    )
                ]
                if extension
                else [],
            )

            self.staff_directory[staff_id] = staff

        # Sample departments
        self.departments["emergency"] = Department(
            dept_id="emergency",
            name="Emergency Department",
            main_extension="5000",
            location="Building A, 1st Floor",
            staff_count=15,
        )

        self.departments["cardiology"] = Department(
            dept_id="cardiology",
            name="Cardiology",
            main_extension="5200",
            location="Building B, 3rd Floor",
            staff_count=10,
        )

        self.departments["icu"] = Department(
            dept_id="icu",
            name="Intensive Care Unit",
            main_extension="5100",
            location="Building A, 4th Floor",
            staff_count=20,
        )

        logger.info(
            f"Loaded {len(self.staff_directory)} staff members "
            f"and {len(self.departments)} departments"
        )


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        # Initialize lookup system
        lookup = CalleeLookupSystem(sip_domain="hospital.local")

        # Search by name
        results = await lookup.search_by_name("Jane")
        print(f"\nSearch 'Jane': {len(results)} results")
        for staff in results:
            print(
                f"  - {staff.first_name} {staff.last_name} "
                f"({staff.role.value}, {staff.department})"
            )
            print(f"    Extension: {staff.extension}")
            print(f"    SIP: {staff.sip_uri}")

        # Get contact URI
        if results:
            staff_id = results[0].staff_id
            uri = await lookup.get_contact_uri(staff_id)
            print(f"\nContact URI for {staff_id}: {uri}")

        # Search by department
        emergency_staff = await lookup.search_by_department("Emergency")
        print(f"\nEmergency Department: {len(emergency_staff)} staff")

        # Get available staff
        available = await lookup.search_available_staff(department="Emergency")
        print(f"Available: {len(available)} staff")

        # Update status
        if results:
            await lookup.update_status(
                results[0].staff_id, AvailabilityStatus.BUSY, "In patient room"
            )

        # Get statistics
        stats = lookup.get_statistics()
        print(f"\nStatistics: {stats}")

    asyncio.run(main())
