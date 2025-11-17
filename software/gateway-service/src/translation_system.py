"""
Real-Time Translation System for Healthcare Communications

Provides multi-language support for patient-staff communication:
- Real-time speech translation
- Medical terminology handling
- Context-aware translation
- Common phrases database
- HIPAA-compliant transcription storage

@version 1.0
@date 2025-11-17
@author OPAL Project Team
"""

import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class Language(Enum):
    """Supported languages"""
    ENGLISH = "en"
    SPANISH = "es"
    MANDARIN = "zh"
    CANTONESE = "yue"
    VIETNAMESE = "vi"
    KOREAN = "ko"
    TAGALOG = "tl"
    RUSSIAN = "ru"
    ARABIC = "ar"
    FRENCH = "fr"
    GERMAN = "de"
    PORTUGUESE = "pt"
    ITALIAN = "it"
    JAPANESE = "ja"
    HINDI = "hi"


class TranslationMode(Enum):
    """Translation modes"""
    TEXT_TO_TEXT = "text_to_text"
    SPEECH_TO_TEXT = "speech_to_text"
    SPEECH_TO_SPEECH = "speech_to_speech"
    TEXT_TO_SPEECH = "text_to_speech"


@dataclass
class TranslationRequest:
    """Translation request structure"""
    request_id: str
    source_lang: Language
    target_lang: Language
    mode: TranslationMode
    input_text: Optional[str] = None
    input_audio: Optional[bytes] = None
    context: str = "medical"
    priority: int = 1
    metadata: Optional[Dict] = None


@dataclass
class TranslationResult:
    """Translation result structure"""
    request_id: str
    source_text: str
    translated_text: str
    source_lang: Language
    target_lang: Language
    confidence: float
    audio_output: Optional[bytes] = None
    processing_time_ms: int = 0
    metadata: Optional[Dict] = None


class MedicalPhrasebook:
    """Common medical phrases database"""

    def __init__(self):
        # Load common medical phrases
        self.phrases = self._load_medical_phrases()

    def _load_medical_phrases(self) -> Dict[str, Dict[str, str]]:
        """Load medical phrases in multiple languages."""
        return {
            # Assessment questions
            "pain_level": {
                Language.ENGLISH.value: "On a scale of 1 to 10, how much pain are you feeling?",
                Language.SPANISH.value: "En una escala del 1 al 10, ¿cuánto dolor siente?",
                Language.MANDARIN.value: "从1到10，你感到多痛？",
                Language.VIETNAMESE.value: "Trên thang điểm từ 1 đến 10, bạn đau mức độ nào?",
                Language.KOREAN.value: "1부터 10까지 척도에서 얼마나 아프십니까?",
                Language.ARABIC.value: "على مقياس من 1 إلى 10، كم تشعر بالألم؟",
            },
            "allergies": {
                Language.ENGLISH.value: "Do you have any allergies to medications?",
                Language.SPANISH.value: "¿Tiene alguna alergia a medicamentos?",
                Language.MANDARIN.value: "您对药物过敏吗？",
                Language.VIETNAMESE.value: "Bạn có dị ứng với thuốc không?",
                Language.KOREAN.value: "약물에 알레르기가 있습니까?",
                Language.ARABIC.value: "هل لديك أي حساسية من الأدوية؟",
            },
            "medication_time": {
                Language.ENGLISH.value: "It's time to take your medication",
                Language.SPANISH.value: "Es hora de tomar su medicamento",
                Language.MANDARIN.value: "该吃药了",
                Language.VIETNAMESE.value: "Đến giờ uống thuốc rồi",
                Language.KOREAN.value: "약 드실 시간입니다",
                Language.ARABIC.value: "حان وقت تناول دوائك",
            },
            "need_help": {
                Language.ENGLISH.value: "Do you need help?",
                Language.SPANISH.value: "¿Necesita ayuda?",
                Language.MANDARIN.value: "您需要帮助吗？",
                Language.VIETNAMESE.value: "Bạn cần giúp đỡ không?",
                Language.KOREAN.value: "도움이 필요하십니까?",
                Language.ARABIC.value: "هل تحتاج إلى مساعدة؟",
            },
            "call_button": {
                Language.ENGLISH.value: "Press the call button if you need assistance",
                Language.SPANISH.value: "Presione el botón de llamada si necesita ayuda",
                Language.MANDARIN.value: "如果需要帮助，请按呼叫按钮",
                Language.VIETNAMESE.value: "Nhấn nút gọi nếu bạn cần hỗ trợ",
                Language.KOREAN.value: "도움이 필요하시면 호출 버튼을 누르세요",
                Language.ARABIC.value: "اضغط على زر الاتصال إذا كنت بحاجة إلى المساعدة",
            },
            "procedure_explanation": {
                Language.ENGLISH.value: "I'm going to explain the procedure to you",
                Language.SPANISH.value: "Voy a explicarle el procedimiento",
                Language.MANDARIN.value: "我将向您解释这个程序",
                Language.VIETNAMESE.value: "Tôi sẽ giải thích quy trình cho bạn",
                Language.KOREAN.value: "절차를 설명해 드리겠습니다",
                Language.ARABIC.value: "سأشرح لك الإجراء",
            },
        }

    def get_phrase(self, phrase_key: str, language: Language) -> Optional[str]:
        """Get translated phrase from phrasebook."""
        phrase_dict = self.phrases.get(phrase_key, {})
        return phrase_dict.get(language.value)

    def list_phrases(self) -> List[str]:
        """List all available phrase keys."""
        return list(self.phrases.keys())


class TranslationSystem:
    """
    Real-time translation system for healthcare communications.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        enable_caching: bool = True,
    ):
        """
        Initialize translation system.

        Args:
            api_key: API key for translation service (Google/Azure)
            enable_caching: Enable translation caching for performance
        """
        self.api_key = api_key
        self.enable_caching = enable_caching

        # Medical phrasebook
        self.phrasebook = MedicalPhrasebook()

        # Translation cache
        self.cache: Dict[str, TranslationResult] = {}

        # Statistics
        self.stats = {
            "total_translations": 0,
            "cache_hits": 0,
            "avg_processing_time_ms": 0,
            "languages_used": {},
        }

        logger.info("Translation system initialized")

    async def translate(
        self,
        source_text: str,
        source_lang: Language,
        target_lang: Language,
        context: str = "medical",
    ) -> TranslationResult:
        """
        Translate text from source to target language.

        Args:
            source_text: Text to translate
            source_lang: Source language
            target_lang: Target language
            context: Translation context (medical/general)

        Returns:
            TranslationResult object
        """
        start_time = datetime.now()
        request_id = self._generate_request_id()

        logger.info(
            f"Translating: {source_lang.value} -> {target_lang.value} "
            f"(context={context})"
        )

        # Check cache
        cache_key = f"{source_text}_{source_lang.value}_{target_lang.value}"
        if self.enable_caching and cache_key in self.cache:
            logger.debug("Cache hit")
            self.stats["cache_hits"] += 1
            return self.cache[cache_key]

        # Perform translation
        translated_text = await self._translate_text(
            source_text, source_lang, target_lang, context
        )

        # Calculate confidence score
        confidence = self._calculate_confidence(source_text, translated_text)

        # Create result
        processing_time = int(
            (datetime.now() - start_time).total_seconds() * 1000
        )

        result = TranslationResult(
            request_id=request_id,
            source_text=source_text,
            translated_text=translated_text,
            source_lang=source_lang,
            target_lang=target_lang,
            confidence=confidence,
            processing_time_ms=processing_time,
            metadata={"context": context},
        )

        # Cache result
        if self.enable_caching:
            self.cache[cache_key] = result

        # Update statistics
        self.stats["total_translations"] += 1
        self._update_language_stats(source_lang, target_lang)
        self._update_avg_processing_time(processing_time)

        return result

    async def translate_speech(
        self,
        audio_data: bytes,
        source_lang: Language,
        target_lang: Language,
        return_audio: bool = True,
    ) -> TranslationResult:
        """
        Translate speech to speech.

        Args:
            audio_data: Input audio data
            source_lang: Source language
            target_lang: Target language
            return_audio: Return translated audio output

        Returns:
            TranslationResult with audio
        """
        logger.info(f"Speech translation: {source_lang.value} -> {target_lang.value}")

        # Step 1: Speech-to-text (source language)
        source_text = await self._speech_to_text(audio_data, source_lang)

        # Step 2: Translate text
        translation = await self.translate(
            source_text, source_lang, target_lang, context="medical"
        )

        # Step 3: Text-to-speech (target language)
        if return_audio:
            translation.audio_output = await self._text_to_speech(
                translation.translated_text, target_lang
            )

        return translation

    async def get_quick_phrase(
        self, phrase_key: str, language: Language
    ) -> Optional[str]:
        """
        Get pre-translated medical phrase.

        Args:
            phrase_key: Phrase identifier
            language: Target language

        Returns:
            Translated phrase or None if not found
        """
        phrase = self.phrasebook.get_phrase(phrase_key, language)

        if phrase:
            logger.info(f"Quick phrase: {phrase_key} ({language.value})")
            self.stats["total_translations"] += 1

        return phrase

    def list_available_phrases(self) -> List[str]:
        """List all available quick phrases."""
        return self.phrasebook.list_phrases()

    def get_supported_languages(self) -> List[Language]:
        """Get list of supported languages."""
        return list(Language)

    def get_statistics(self) -> Dict:
        """Get translation statistics."""
        cache_hit_rate = 0
        if self.stats["total_translations"] > 0:
            cache_hit_rate = (
                self.stats["cache_hits"] / self.stats["total_translations"]
            ) * 100

        return {
            **self.stats,
            "cache_hit_rate": f"{cache_hit_rate:.1f}%",
            "cache_size": len(self.cache),
        }

    def clear_cache(self):
        """Clear translation cache."""
        self.cache.clear()
        logger.info("Translation cache cleared")

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        import uuid

        return f"trans-{uuid.uuid4().hex[:12]}"

    async def _translate_text(
        self,
        text: str,
        source_lang: Language,
        target_lang: Language,
        context: str,
    ) -> str:
        """
        Perform actual text translation.

        TODO: Integrate with translation API:
        - Google Cloud Translation API
        - Azure Translator
        - AWS Translate
        """
        # For now, return a placeholder
        # In production, this would call the translation API

        # Simulate API call delay
        await asyncio.sleep(0.1)

        # Mock translation
        if target_lang == Language.SPANISH:
            mock_translations = {
                "hello": "hola",
                "goodbye": "adiós",
                "pain": "dolor",
                "help": "ayuda",
            }
            for eng, esp in mock_translations.items():
                text = text.lower().replace(eng, esp)

        return f"[{target_lang.value}] {text}"

    async def _speech_to_text(
        self, audio_data: bytes, language: Language
    ) -> str:
        """
        Convert speech to text.

        TODO: Integrate with ASR service:
        - Google Cloud Speech-to-Text
        - Azure Speech Services
        - AWS Transcribe Medical
        """
        logger.debug(f"ASR: Converting speech to text ({language.value})")

        # Simulate processing
        await asyncio.sleep(0.2)

        return f"[Transcribed text in {language.value}]"

    async def _text_to_speech(
        self, text: str, language: Language
    ) -> bytes:
        """
        Convert text to speech.

        TODO: Integrate with TTS service:
        - Google Cloud Text-to-Speech
        - Azure Speech Services
        - AWS Polly
        """
        logger.debug(f"TTS: Converting text to speech ({language.value})")

        # Simulate processing
        await asyncio.sleep(0.15)

        return b"[Audio data]"

    def _calculate_confidence(self, source_text: str, translated_text: str) -> float:
        """Calculate translation confidence score."""
        # Simple heuristic based on length ratio
        if not source_text or not translated_text:
            return 0.0

        length_ratio = len(translated_text) / len(source_text)

        # Expect translated text to be within 50%-200% of source length
        if 0.5 <= length_ratio <= 2.0:
            confidence = 0.9
        elif 0.3 <= length_ratio <= 3.0:
            confidence = 0.7
        else:
            confidence = 0.5

        return confidence

    def _update_language_stats(self, source_lang: Language, target_lang: Language):
        """Update language usage statistics."""
        pair = f"{source_lang.value}->{target_lang.value}"

        if pair not in self.stats["languages_used"]:
            self.stats["languages_used"][pair] = 0

        self.stats["languages_used"][pair] += 1

    def _update_avg_processing_time(self, processing_time_ms: int):
        """Update average processing time."""
        total = self.stats["total_translations"]
        current_avg = self.stats["avg_processing_time_ms"]

        new_avg = ((current_avg * (total - 1)) + processing_time_ms) / total
        self.stats["avg_processing_time_ms"] = int(new_avg)


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        # Initialize system
        translation_system = TranslationSystem(enable_caching=True)

        # Text translation
        result = await translation_system.translate(
            source_text="Do you have any pain?",
            source_lang=Language.ENGLISH,
            target_lang=Language.SPANISH,
            context="medical",
        )

        print(f"Translation: {result.translated_text}")
        print(f"Confidence: {result.confidence:.2f}")
        print(f"Processing time: {result.processing_time_ms}ms")

        # Quick phrase
        phrase = await translation_system.get_quick_phrase(
            "pain_level", Language.MANDARIN
        )
        print(f"Quick phrase: {phrase}")

        # List available phrases
        phrases = translation_system.list_available_phrases()
        print(f"Available phrases: {phrases}")

        # Statistics
        stats = translation_system.get_statistics()
        print(f"Statistics: {stats}")

    asyncio.run(main())
