"""
Alert and Paging System for Hospital Communications

Implements multi-channel alert and paging system for healthcare:
- Emergency alerts (Code Blue, Rapid Response, etc.)
- Departmental paging
- Targeted staff notifications
- Overhead paging integration
- Mobile push notifications
- Priority routing

@version 1.0
@date 2025-11-17
@author OPAL Project Team
"""

import asyncio
import logging
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class AlertPriority(Enum):
    """Alert priority levels"""
    INFO = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    URGENT = 4
    EMERGENCY = 5


class AlertType(Enum):
    """Alert types"""
    GENERAL = "general"
    CODE_BLUE = "code_blue"
    CODE_RED = "code_red"  # Fire
    CODE_YELLOW = "code_yellow"  # Missing patient
    CODE_SILVER = "code_silver"  # Active shooter
    RAPID_RESPONSE = "rapid_response"
    STAFF_ASSIST = "staff_assist"
    EQUIPMENT = "equipment"
    MEDICATION = "medication"
    PATIENT = "patient"


class DeliveryChannel(Enum):
    """Alert delivery channels"""
    AUDIO_PAGE = "audio_page"  # Overhead speakers
    MOBILE_PUSH = "mobile_push"  # Mobile app notifications
    SMS = "sms"
    EMAIL = "email"
    VOIP_CALL = "voip_call"  # Direct VoIP call
    DESKTOP_NOTIFICATION = "desktop"
    ALL = "all"  # All available channels


@dataclass
class Alert:
    """Alert message structure"""
    alert_id: str
    alert_type: AlertType
    priority: AlertPriority
    title: str
    message: str
    location: str
    department: str
    timestamp: datetime
    sender_id: str
    sender_name: str
    recipients: List[str]
    channels: List[DeliveryChannel]
    metadata: Dict
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AlertPagingSystem:
    """
    Comprehensive alert and paging system for hospital communications.
    """

    def __init__(self):
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: List[Alert] = []
        self.department_zones: Dict[str, List[str]] = {}
        self.staff_registry: Dict[str, Dict] = {}

        # Statistics
        self.stats = {
            "total_alerts": 0,
            "emergency_alerts": 0,
            "acknowledged_alerts": 0,
            "avg_response_time_sec": 0,
        }

        logger.info("Alert and paging system initialized")

    async def send_alert(
        self,
        alert_type: AlertType,
        priority: AlertPriority,
        title: str,
        message: str,
        location: str,
        department: str,
        sender_id: str,
        sender_name: str,
        recipients: Optional[List[str]] = None,
        channels: Optional[List[DeliveryChannel]] = None,
        metadata: Optional[Dict] = None,
    ) -> Alert:
        """
        Send alert to specified recipients via multiple channels.

        Args:
            alert_type: Type of alert
            priority: Priority level
            title: Alert title
            message: Alert message
            location: Location of incident
            department: Target department
            sender_id: Sender user ID
            sender_name: Sender display name
            recipients: List of recipient IDs (None = all department)
            channels: Delivery channels (None = default based on priority)
            metadata: Additional metadata

        Returns:
            Alert object
        """
        alert_id = self._generate_alert_id()

        # Auto-select channels based on priority
        if channels is None:
            channels = self._select_channels(priority)

        # Auto-select recipients if not specified
        if recipients is None:
            recipients = self._get_department_staff(department)

        alert = Alert(
            alert_id=alert_id,
            alert_type=alert_type,
            priority=priority,
            title=title,
            message=message,
            location=location,
            department=department,
            timestamp=datetime.now(),
            sender_id=sender_id,
            sender_name=sender_name,
            recipients=recipients,
            channels=channels,
            metadata=metadata or {},
        )

        logger.info(
            f"Sending alert {alert_id}: {alert_type.value} "
            f"(priority={priority.name}, location={location})"
        )

        # Store alert
        self.active_alerts[alert_id] = alert
        self.alert_history.append(alert)
        self.stats["total_alerts"] += 1

        if priority == AlertPriority.EMERGENCY:
            self.stats["emergency_alerts"] += 1

        # Deliver via all specified channels
        await self._deliver_alert(alert)

        return alert

    async def send_emergency_alert(
        self,
        emergency_type: AlertType,
        location: str,
        additional_info: str = "",
    ) -> Alert:
        """
        Send high-priority emergency alert.

        Args:
            emergency_type: Type of emergency (CODE_BLUE, etc.)
            location: Emergency location
            additional_info: Additional information

        Returns:
            Alert object
        """
        emergency_messages = {
            AlertType.CODE_BLUE: "Code Blue - Cardiac/Respiratory Arrest",
            AlertType.CODE_RED: "Code Red - Fire Emergency",
            AlertType.CODE_YELLOW: "Code Yellow - Missing Patient",
            AlertType.CODE_SILVER: "Code Silver - Active Threat",
            AlertType.RAPID_RESPONSE: "Rapid Response Team Activation",
        }

        title = emergency_messages.get(
            emergency_type, f"{emergency_type.value} Emergency"
        )

        message = f"{title} at {location}. {additional_info}".strip()

        logger.critical(f"EMERGENCY ALERT: {message}")

        # Emergency alerts go to ALL staff in affected departments
        return await self.send_alert(
            alert_type=emergency_type,
            priority=AlertPriority.EMERGENCY,
            title=title,
            message=message,
            location=location,
            department="all",  # Broadcast to all
            sender_id="system",
            sender_name="Hospital Alert System",
            recipients=None,  # All staff
            channels=[DeliveryChannel.ALL],
            metadata={
                "emergency": True,
                "requires_acknowledgment": True,
                "alert_tone": "emergency",
            },
        )

    async def page_department(
        self,
        department: str,
        message: str,
        sender_name: str,
        priority: AlertPriority = AlertPriority.MEDIUM,
    ) -> Alert:
        """
        Send audio page to department overhead speakers.

        Args:
            department: Target department
            message: Page message
            sender_name: Sender name
            priority: Priority level

        Returns:
            Alert object
        """
        logger.info(f"Paging department {department}: {message}")

        return await self.send_alert(
            alert_type=AlertType.GENERAL,
            priority=priority,
            title=f"Page to {department}",
            message=message,
            location=department,
            department=department,
            sender_id="system",
            sender_name=sender_name,
            recipients=None,  # All in department
            channels=[DeliveryChannel.AUDIO_PAGE],
            metadata={"page_type": "department"},
        )

    async def page_staff_member(
        self,
        staff_id: str,
        message: str,
        sender_name: str,
        urgent: bool = False,
    ) -> Alert:
        """
        Page specific staff member.

        Args:
            staff_id: Staff member ID
            message: Page message
            sender_name: Sender name
            urgent: Urgent priority

        Returns:
            Alert object
        """
        priority = AlertPriority.URGENT if urgent else AlertPriority.MEDIUM

        staff_info = self.staff_registry.get(staff_id, {})
        staff_name = staff_info.get("name", staff_id)

        logger.info(f"Paging staff {staff_name}: {message}")

        return await self.send_alert(
            alert_type=AlertType.STAFF_ASSIST,
            priority=priority,
            title=f"Page for {staff_name}",
            message=message,
            location="",
            department=staff_info.get("department", ""),
            sender_id="system",
            sender_name=sender_name,
            recipients=[staff_id],
            channels=[DeliveryChannel.MOBILE_PUSH, DeliveryChannel.VOIP_CALL],
            metadata={"page_type": "individual"},
        )

    async def acknowledge_alert(
        self, alert_id: str, acknowledger_id: str
    ) -> bool:
        """
        Acknowledge alert.

        Args:
            alert_id: Alert ID
            acknowledger_id: User acknowledging

        Returns:
            True if successful
        """
        if alert_id not in self.active_alerts:
            logger.error(f"Alert {alert_id} not found")
            return False

        alert = self.active_alerts[alert_id]

        if alert.acknowledged:
            logger.warning(f"Alert {alert_id} already acknowledged")
            return False

        alert.acknowledged = True
        alert.acknowledged_by = acknowledger_id
        alert.acknowledged_at = datetime.now()

        response_time = (alert.acknowledged_at - alert.timestamp).total_seconds()

        logger.info(
            f"Alert {alert_id} acknowledged by {acknowledger_id} "
            f"(response_time={response_time:.1f}s)"
        )

        self.stats["acknowledged_alerts"] += 1

        # Update average response time
        total_response_time = (
            self.stats["avg_response_time_sec"]
            * (self.stats["acknowledged_alerts"] - 1)
            + response_time
        )
        self.stats["avg_response_time_sec"] = (
            total_response_time / self.stats["acknowledged_alerts"]
        )

        return True

    async def cancel_alert(self, alert_id: str) -> bool:
        """Cancel active alert."""
        if alert_id not in self.active_alerts:
            return False

        logger.info(f"Cancelling alert {alert_id}")
        del self.active_alerts[alert_id]

        return True

    def get_active_alerts(
        self, department: Optional[str] = None, priority: Optional[AlertPriority] = None
    ) -> List[Alert]:
        """Get list of active alerts with optional filtering."""
        alerts = list(self.active_alerts.values())

        if department:
            alerts = [a for a in alerts if a.department == department]

        if priority:
            alerts = [a for a in alerts if a.priority == priority]

        # Sort by priority (highest first) then timestamp (newest first)
        alerts.sort(
            key=lambda a: (-a.priority.value, -a.timestamp.timestamp())
        )

        return alerts

    def get_statistics(self) -> Dict:
        """Get alert statistics."""
        return {
            **self.stats,
            "active_alerts_count": len(self.active_alerts),
            "acknowledgment_rate": (
                self.stats["acknowledged_alerts"] / max(1, self.stats["total_alerts"])
            )
            * 100,
        }

    def register_staff(
        self,
        staff_id: str,
        name: str,
        department: str,
        role: str,
        contact_info: Dict,
    ):
        """Register staff member for paging."""
        self.staff_registry[staff_id] = {
            "name": name,
            "department": department,
            "role": role,
            "contact": contact_info,
        }

        logger.debug(f"Registered staff: {name} ({staff_id})")

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _generate_alert_id(self) -> str:
        """Generate unique alert ID."""
        import uuid

        return f"alert-{uuid.uuid4().hex[:16]}"

    def _select_channels(self, priority: AlertPriority) -> List[DeliveryChannel]:
        """Auto-select delivery channels based on priority."""
        if priority == AlertPriority.EMERGENCY:
            return [DeliveryChannel.ALL]
        elif priority in (AlertPriority.URGENT, AlertPriority.HIGH):
            return [
                DeliveryChannel.MOBILE_PUSH,
                DeliveryChannel.AUDIO_PAGE,
                DeliveryChannel.DESKTOP_NOTIFICATION,
            ]
        elif priority == AlertPriority.MEDIUM:
            return [DeliveryChannel.MOBILE_PUSH, DeliveryChannel.DESKTOP_NOTIFICATION]
        else:
            return [DeliveryChannel.DESKTOP_NOTIFICATION]

    def _get_department_staff(self, department: str) -> List[str]:
        """Get list of staff IDs in department."""
        if department == "all":
            return list(self.staff_registry.keys())

        return [
            staff_id
            for staff_id, info in self.staff_registry.items()
            if info.get("department") == department
        ]

    async def _deliver_alert(self, alert: Alert):
        """Deliver alert via all specified channels."""
        tasks = []

        for channel in alert.channels:
            if channel == DeliveryChannel.ALL:
                # Deliver via all channels
                tasks.extend(
                    [
                        self._deliver_audio_page(alert),
                        self._deliver_mobile_push(alert),
                        self._deliver_desktop_notification(alert),
                    ]
                )
            elif channel == DeliveryChannel.AUDIO_PAGE:
                tasks.append(self._deliver_audio_page(alert))
            elif channel == DeliveryChannel.MOBILE_PUSH:
                tasks.append(self._deliver_mobile_push(alert))
            elif channel == DeliveryChannel.DESKTOP_NOTIFICATION:
                tasks.append(self._deliver_desktop_notification(alert))
            elif channel == DeliveryChannel.VOIP_CALL:
                tasks.append(self._deliver_voip_call(alert))
            elif channel == DeliveryChannel.SMS:
                tasks.append(self._deliver_sms(alert))
            elif channel == DeliveryChannel.EMAIL:
                tasks.append(self._deliver_email(alert))

        # Execute all deliveries concurrently
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_audio_page(self, alert: Alert):
        """Deliver alert via overhead audio paging."""
        logger.info(f"Audio paging alert {alert.alert_id} to {alert.department}")
        # TODO: Integrate with hospital paging system (SIP/VoIP)
        await asyncio.sleep(0.1)

    async def _deliver_mobile_push(self, alert: Alert):
        """Deliver alert via mobile push notification."""
        logger.info(f"Sending push notification for alert {alert.alert_id}")
        # TODO: Integrate with mobile push service (Firebase/APNs)
        await asyncio.sleep(0.1)

    async def _deliver_desktop_notification(self, alert: Alert):
        """Deliver alert via desktop notification."""
        logger.info(f"Sending desktop notification for alert {alert.alert_id}")
        # TODO: Send via WebSocket to desktop clients
        await asyncio.sleep(0.1)

    async def _deliver_voip_call(self, alert: Alert):
        """Deliver alert via direct VoIP call."""
        logger.info(f"Initiating VoIP call for alert {alert.alert_id}")
        # TODO: Integrate with voice_call_system.py
        await asyncio.sleep(0.1)

    async def _deliver_sms(self, alert: Alert):
        """Deliver alert via SMS."""
        logger.info(f"Sending SMS for alert {alert.alert_id}")
        # TODO: Integrate with SMS gateway (Twilio/etc)
        await asyncio.sleep(0.1)

    async def _deliver_email(self, alert: Alert):
        """Deliver alert via email."""
        logger.info(f"Sending email for alert {alert.alert_id}")
        # TODO: Integrate with email service (SMTP)
        await asyncio.sleep(0.1)


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        # Initialize system
        alert_system = AlertPagingSystem()

        # Register staff
        alert_system.register_staff(
            staff_id="nurse101",
            name="Jane Doe",
            department="Emergency",
            role="RN",
            contact_info={"phone": "+1234567890", "email": "jane@hospital.local"},
        )

        # Send Code Blue emergency
        alert = await alert_system.send_emergency_alert(
            emergency_type=AlertType.CODE_BLUE,
            location="Room 302, 3rd Floor East Wing",
            additional_info="Adult male, unresponsive",
        )

        print(f"Emergency alert sent: {alert.alert_id}")

        # Acknowledge alert
        await asyncio.sleep(2)
        await alert_system.acknowledge_alert(alert.alert_id, "nurse101")

        # Send department page
        await alert_system.page_department(
            department="Cardiology",
            message="Dr. Smith, please call extension 4567",
            sender_name="Front Desk",
        )

        # Get statistics
        stats = alert_system.get_statistics()
        print(f"Statistics: {stats}")

    asyncio.run(main())
