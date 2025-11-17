"""
Medical Procedure Step Retrieval System

Provides step-by-step guidance for medical procedures:
- Procedure lookup by name/code
- Sequential step delivery
- Visual/audio guidance
- Safety checklists
- Real-time assistance during procedures
- Integration with hospital protocols

@version 1.0
@date 2025-11-17
@author OPAL Project Team
"""

import asyncio
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class ProcedureCategory(Enum):
    """Procedure categories"""
    ASSESSMENT = "assessment"
    MEDICATION = "medication"
    WOUND_CARE = "wound_care"
    IV_THERAPY = "iv_therapy"
    RESPIRATORY = "respiratory"
    CARDIAC = "cardiac"
    SPECIMEN_COLLECTION = "specimen_collection"
    INFECTION_CONTROL = "infection_control"
    PATIENT_CARE = "patient_care"
    EMERGENCY = "emergency"


class StepType(Enum):
    """Step types"""
    PREPARATION = "preparation"
    ACTION = "action"
    VERIFICATION = "verification"
    SAFETY_CHECK = "safety_check"
    DOCUMENTATION = "documentation"
    COMPLETION = "completion"


@dataclass
class ProcedureStep:
    """Individual procedure step"""
    step_number: int
    step_type: StepType
    title: str
    description: str
    instructions: List[str]
    warnings: List[str] = field(default_factory=list)
    safety_checks: List[str] = field(default_factory=list)
    estimated_time_sec: int = 30
    requires_confirmation: bool = False
    media_url: Optional[str] = None  # Image/video demonstration
    audio_guidance: Optional[str] = None


@dataclass
class MedicalProcedure:
    """Medical procedure definition"""
    procedure_id: str
    name: str
    category: ProcedureCategory
    description: str
    steps: List[ProcedureStep]
    prerequisites: List[str] = field(default_factory=list)
    required_equipment: List[str] = field(default_factory=list)
    required_supplies: List[str] = field(default_factory=list)
    estimated_duration_min: int = 10
    skill_level: str = "intermediate"
    protocol_version: str = "1.0"
    last_updated: Optional[datetime] = None


@dataclass
class ProcedureSession:
    """Active procedure guidance session"""
    session_id: str
    procedure: MedicalProcedure
    current_step: int = 0
    start_time: Optional[datetime] = None
    completed_steps: List[int] = field(default_factory=list)
    skipped_steps: List[int] = field(default_factory=list)
    notes: Dict[int, str] = field(default_factory=dict)
    completed: bool = False


class ProcedureRetrievalSystem:
    """
    System for retrieving and delivering medical procedure guidance.
    """

    def __init__(self):
        self.procedures: Dict[str, MedicalProcedure] = {}
        self.active_sessions: Dict[str, ProcedureSession] = {}

        # Load procedure database
        self._load_procedures()

        # Statistics
        self.stats = {
            "total_procedures": len(self.procedures),
            "sessions_started": 0,
            "sessions_completed": 0,
            "most_requested": {},
        }

        logger.info(
            f"Procedure retrieval system initialized "
            f"({self.stats['total_procedures']} procedures loaded)"
        )

    async def search_procedures(
        self,
        query: str,
        category: Optional[ProcedureCategory] = None,
    ) -> List[MedicalProcedure]:
        """
        Search for procedures by name or keywords.

        Args:
            query: Search query
            category: Optional category filter

        Returns:
            List of matching procedures
        """
        query_lower = query.lower()
        results = []

        for proc in self.procedures.values():
            # Check category match
            if category and proc.category != category:
                continue

            # Check name/description match
            if (
                query_lower in proc.name.lower()
                or query_lower in proc.description.lower()
            ):
                results.append(proc)

        logger.info(f"Search '{query}': {len(results)} results")
        return results

    async def get_procedure(self, procedure_id: str) -> Optional[MedicalProcedure]:
        """Get procedure by ID."""
        return self.procedures.get(procedure_id)

    async def start_procedure_session(
        self, procedure_id: str
    ) -> Optional[ProcedureSession]:
        """
        Start guided procedure session.

        Args:
            procedure_id: Procedure identifier

        Returns:
            ProcedureSession object
        """
        procedure = await self.get_procedure(procedure_id)

        if not procedure:
            logger.error(f"Procedure {procedure_id} not found")
            return None

        session_id = self._generate_session_id()

        session = ProcedureSession(
            session_id=session_id,
            procedure=procedure,
            current_step=0,
            start_time=datetime.now(),
        )

        self.active_sessions[session_id] = session
        self.stats["sessions_started"] += 1

        # Update most requested statistics
        if procedure_id not in self.stats["most_requested"]:
            self.stats["most_requested"][procedure_id] = 0
        self.stats["most_requested"][procedure_id] += 1

        logger.info(
            f"Started procedure session {session_id} "
            f"for '{procedure.name}' ({len(procedure.steps)} steps)"
        )

        return session

    async def get_current_step(self, session_id: str) -> Optional[ProcedureStep]:
        """Get current step in active session."""
        session = self.active_sessions.get(session_id)

        if not session:
            return None

        if session.current_step >= len(session.procedure.steps):
            return None

        return session.procedure.steps[session.current_step]

    async def get_next_step(self, session_id: str) -> Optional[ProcedureStep]:
        """Advance to next step and return it."""
        session = self.active_sessions.get(session_id)

        if not session:
            logger.error(f"Session {session_id} not found")
            return None

        # Mark current step as completed
        if session.current_step < len(session.procedure.steps):
            session.completed_steps.append(session.current_step)

        # Advance to next step
        session.current_step += 1

        # Check if completed
        if session.current_step >= len(session.procedure.steps):
            session.completed = True
            self.stats["sessions_completed"] += 1
            logger.info(f"Session {session_id} completed")
            return None

        next_step = session.procedure.steps[session.current_step]

        logger.info(
            f"Session {session_id}: Advancing to step {session.current_step + 1} "
            f"of {len(session.procedure.steps)}"
        )

        return next_step

    async def get_previous_step(self, session_id: str) -> Optional[ProcedureStep]:
        """Go back to previous step."""
        session = self.active_sessions.get(session_id)

        if not session or session.current_step == 0:
            return None

        session.current_step -= 1
        return session.procedure.steps[session.current_step]

    async def skip_step(self, session_id: str, reason: str) -> Optional[ProcedureStep]:
        """Skip current step (with reason)."""
        session = self.active_sessions.get(session_id)

        if not session:
            return None

        # Record skipped step
        session.skipped_steps.append(session.current_step)
        session.notes[session.current_step] = f"Skipped: {reason}"

        logger.warning(
            f"Session {session_id}: Step {session.current_step + 1} skipped ({reason})"
        )

        # Advance to next step
        return await self.get_next_step(session_id)

    async def add_step_note(self, session_id: str, step_number: int, note: str) -> bool:
        """Add note to specific step."""
        session = self.active_sessions.get(session_id)

        if not session:
            return False

        session.notes[step_number] = note
        logger.debug(f"Session {session_id}: Note added to step {step_number}")

        return True

    async def get_session_progress(self, session_id: str) -> Optional[Dict]:
        """Get progress information for session."""
        session = self.active_sessions.get(session_id)

        if not session:
            return None

        total_steps = len(session.procedure.steps)
        elapsed_time = 0

        if session.start_time:
            elapsed_time = int(
                (datetime.now() - session.start_time).total_seconds() / 60
            )

        return {
            "session_id": session_id,
            "procedure_name": session.procedure.name,
            "current_step": session.current_step + 1,
            "total_steps": total_steps,
            "progress_percent": int((session.current_step / total_steps) * 100),
            "completed_steps": len(session.completed_steps),
            "skipped_steps": len(session.skipped_steps),
            "elapsed_time_min": elapsed_time,
            "estimated_remaining_min": session.procedure.estimated_duration_min
            - elapsed_time,
            "completed": session.completed,
        }

    async def end_session(self, session_id: str) -> bool:
        """End procedure session."""
        if session_id not in self.active_sessions:
            return False

        session = self.active_sessions[session_id]

        logger.info(
            f"Ending session {session_id} for '{session.procedure.name}' "
            f"(completed={session.completed})"
        )

        # Archive session (in production, save to database)
        del self.active_sessions[session_id]

        return True

    def get_statistics(self) -> Dict:
        """Get system statistics."""
        # Sort most requested procedures
        most_requested = sorted(
            self.stats["most_requested"].items(), key=lambda x: x[1], reverse=True
        )[:5]

        return {
            **self.stats,
            "active_sessions": len(self.active_sessions),
            "top_procedures": [
                {
                    "procedure_id": proc_id,
                    "name": self.procedures[proc_id].name,
                    "requests": count,
                }
                for proc_id, count in most_requested
                if proc_id in self.procedures
            ],
        }

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _generate_session_id(self) -> str:
        """Generate unique session ID."""
        import uuid

        return f"proc-{uuid.uuid4().hex[:16]}"

    def _load_procedures(self):
        """Load procedure database."""
        # Sample procedures - in production, load from database

        # Blood Pressure Measurement
        bp_procedure = MedicalProcedure(
            procedure_id="vital_bp_001",
            name="Blood Pressure Measurement",
            category=ProcedureCategory.ASSESSMENT,
            description="Standard procedure for measuring patient blood pressure",
            steps=[
                ProcedureStep(
                    step_number=1,
                    step_type=StepType.PREPARATION,
                    title="Gather Equipment",
                    description="Collect necessary equipment",
                    instructions=[
                        "Get blood pressure cuff (appropriate size)",
                        "Get stethoscope",
                        "Sanitize equipment",
                    ],
                    estimated_time_sec=30,
                ),
                ProcedureStep(
                    step_number=2,
                    step_type=StepType.PREPARATION,
                    title="Patient Preparation",
                    description="Prepare patient for measurement",
                    instructions=[
                        "Have patient sit quietly for 5 minutes",
                        "Ensure patient's arm is at heart level",
                        "Remove tight clothing from arm",
                    ],
                    warnings=["Patient should not have consumed caffeine in last 30 min"],
                    estimated_time_sec=300,
                ),
                ProcedureStep(
                    step_number=3,
                    step_type=StepType.ACTION,
                    title="Apply Cuff",
                    description="Properly position blood pressure cuff",
                    instructions=[
                        "Wrap cuff around upper arm",
                        "Position cuff 1 inch above elbow crease",
                        "Ensure cuff is snug but not tight",
                    ],
                    estimated_time_sec=20,
                ),
                ProcedureStep(
                    step_number=4,
                    step_type=StepType.ACTION,
                    title="Take Measurement",
                    description="Measure blood pressure",
                    instructions=[
                        "Place stethoscope over brachial artery",
                        "Inflate cuff 20-30 mmHg above expected systolic",
                        "Slowly release air (2-3 mmHg per second)",
                        "Note systolic pressure (first sound)",
                        "Note diastolic pressure (sound disappears)",
                    ],
                    estimated_time_sec=60,
                ),
                ProcedureStep(
                    step_number=5,
                    step_type=StepType.DOCUMENTATION,
                    title="Record Results",
                    description="Document measurement",
                    instructions=[
                        "Record systolic and diastolic readings",
                        "Note patient position and arm used",
                        "Note any irregularities",
                    ],
                    requires_confirmation=True,
                    estimated_time_sec=30,
                ),
            ],
            required_equipment=["Blood pressure cuff", "Stethoscope"],
            estimated_duration_min=10,
            skill_level="basic",
            protocol_version="2.1",
            last_updated=datetime.now(),
        )

        self.procedures["vital_bp_001"] = bp_procedure

        # IV Catheter Insertion
        iv_procedure = MedicalProcedure(
            procedure_id="iv_insertion_001",
            name="Peripheral IV Catheter Insertion",
            category=ProcedureCategory.IV_THERAPY,
            description="Sterile procedure for inserting peripheral IV catheter",
            steps=[
                ProcedureStep(
                    step_number=1,
                    step_type=StepType.PREPARATION,
                    title="Hand Hygiene and PPE",
                    description="Perform hand hygiene and don PPE",
                    instructions=[
                        "Wash hands thoroughly",
                        "Don non-sterile gloves",
                        "Consider gown if splashing risk",
                    ],
                    safety_checks=["Hand hygiene completed"],
                    estimated_time_sec=60,
                ),
                ProcedureStep(
                    step_number=2,
                    step_type=StepType.PREPARATION,
                    title="Gather Supplies",
                    description="Collect all necessary supplies",
                    instructions=[
                        "IV catheter (appropriate gauge)",
                        "Tourniquet",
                        "Alcohol swabs",
                        "Chlorhexidine swab",
                        "Transparent dressing",
                        "Tape",
                        "Saline flush",
                    ],
                    estimated_time_sec=60,
                ),
                ProcedureStep(
                    step_number=3,
                    step_type=StepType.SAFETY_CHECK,
                    title="Patient Identification",
                    description="Verify patient identity",
                    instructions=[
                        "Check patient ID band",
                        "Ask patient to state name and DOB",
                        "Confirm against medical record",
                    ],
                    safety_checks=[
                        "Two patient identifiers verified",
                        "Allergy check completed",
                    ],
                    requires_confirmation=True,
                    estimated_time_sec=30,
                ),
                ProcedureStep(
                    step_number=4,
                    step_type=StepType.ACTION,
                    title="Select Vein",
                    description="Identify appropriate vein",
                    instructions=[
                        "Apply tourniquet 4-6 inches above insertion site",
                        "Palpate vein for suitability",
                        "Select distal site when possible",
                        "Avoid joints, previous insertion sites",
                    ],
                    warnings=[
                        "Do not use arm with AV fistula",
                        "Avoid mastectomy side",
                    ],
                    estimated_time_sec=60,
                ),
                ProcedureStep(
                    step_number=5,
                    step_type=StepType.ACTION,
                    title="Prepare Insertion Site",
                    description="Cleanse insertion site",
                    instructions=[
                        "Clean site with alcohol swab",
                        "Apply chlorhexidine in circular motion",
                        "Allow site to dry completely (30 seconds)",
                    ],
                    warnings=["Do not touch site after cleaning"],
                    estimated_time_sec=45,
                ),
                ProcedureStep(
                    step_number=6,
                    step_type=StepType.ACTION,
                    title="Insert Catheter",
                    description="Perform venipuncture",
                    instructions=[
                        "Stabilize vein with non-dominant hand",
                        "Insert catheter at 10-30 degree angle",
                        "Look for blood flashback",
                        "Advance catheter into vein",
                        "Remove needle while securing catheter",
                    ],
                    warnings=["Never reinsert needle into catheter"],
                    estimated_time_sec=60,
                ),
                ProcedureStep(
                    step_number=7,
                    step_type=StepType.VERIFICATION,
                    title="Verify Placement",
                    description="Confirm IV is patent",
                    instructions=[
                        "Release tourniquet",
                        "Flush with saline",
                        "Check for swelling or infiltration",
                        "Secure with dressing",
                    ],
                    safety_checks=["Patent IV verified", "No infiltration"],
                    requires_confirmation=True,
                    estimated_time_sec=60,
                ),
                ProcedureStep(
                    step_number=8,
                    step_type=StepType.DOCUMENTATION,
                    title="Document Procedure",
                    description="Complete documentation",
                    instructions=[
                        "Record date/time of insertion",
                        "Document catheter gauge and location",
                        "Note number of attempts",
                        "Document patient tolerance",
                    ],
                    requires_confirmation=True,
                    estimated_time_sec=60,
                ),
            ],
            required_equipment=[
                "IV catheter",
                "Tourniquet",
                "Chlorhexidine swabs",
                "Transparent dressing",
                "Saline flush",
            ],
            estimated_duration_min=15,
            skill_level="intermediate",
            protocol_version="3.0",
            last_updated=datetime.now(),
        )

        self.procedures["iv_insertion_001"] = iv_procedure

        logger.info(f"Loaded {len(self.procedures)} procedures")


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        # Initialize system
        proc_system = ProcedureRetrievalSystem()

        # Search for procedures
        results = await proc_system.search_procedures("blood pressure")
        print(f"Found {len(results)} procedures")

        # Start procedure session
        if results:
            procedure = results[0]
            session = await proc_system.start_procedure_session(procedure.procedure_id)

            if session:
                print(f"\nStarted: {procedure.name}")
                print(f"Total steps: {len(procedure.steps)}")

                # Walk through steps
                for i in range(len(procedure.steps)):
                    step = await proc_system.get_current_step(session.session_id)

                    if step:
                        print(f"\nStep {step.step_number}: {step.title}")
                        print(f"Type: {step.step_type.value}")
                        print(f"Instructions:")
                        for instruction in step.instructions:
                            print(f"  - {instruction}")

                        if step.warnings:
                            print("⚠️  Warnings:")
                            for warning in step.warnings:
                                print(f"  - {warning}")

                        # Advance to next step
                        await proc_system.get_next_step(session.session_id)

                # Get progress
                progress = await proc_system.get_session_progress(session.session_id)
                print(f"\nProgress: {progress}")

                # End session
                await proc_system.end_session(session.session_id)

        # Get statistics
        stats = proc_system.get_statistics()
        print(f"\nStatistics: {stats}")

    asyncio.run(main())
