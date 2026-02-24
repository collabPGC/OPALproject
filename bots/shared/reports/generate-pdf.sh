#!/bin/bash
# Report PDF Generator
# Usage: ./generate-pdf.sh input.md output.pdf [style]
# Styles: executive (default), technical, minimal

INPUT="$1"
OUTPUT="$2"
STYLE="${3:-executive}"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
    echo "Usage: $0 input.md output.pdf [style]"
    echo "Styles: executive, technical, minimal"
    exit 1
fi

TEMPLATE_DIR="/opt/mattermost/bots-v2/shared/reports/templates"

case "$STYLE" in
    executive)
        pandoc "$INPUT" -o "$OUTPUT" \
            --template eisvogel \
            --pdf-engine=pdflatex \
            -V titlepage=true \
            -V titlepage-color="0f172a" \
            -V titlepage-text-color="FFFFFF" \
            -V titlepage-rule-color="3b82f6" \
            -V titlepage-rule-height=4 \
            -V geometry:margin=1.25in \
            -V fontsize=11pt \
            -V linestretch=1.3 \
            -V linkcolor=blue \
            -V toc=true \
            -V toc-depth=2 \
            -V toc-own-page=true \
            -V header-right="\thepage" \
            -V footer-left="CONFIDENTIAL" \
            -V footer-right="Scout Bot" \
            --number-sections \
            --highlight-style=kate
        ;;
    technical)
        pandoc "$INPUT" -o "$OUTPUT" \
            --template eisvogel \
            --pdf-engine=pdflatex \
            -V titlepage=true \
            -V titlepage-color="1e293b" \
            -V titlepage-text-color="FFFFFF" \
            -V titlepage-rule-color="22c55e" \
            -V titlepage-rule-height=3 \
            -V geometry:margin=0.9in \
            -V fontsize=10pt \
            -V linestretch=1.15 \
            -V linkcolor=green \
            -V toc=true \
            -V toc-depth=3 \
            -V toc-own-page=true \
            -V header-left="Technical Report" \
            -V header-right="\thepage" \
            -V footer-left="\today" \
            -V footer-right="Scout Bot" \
            -V listings=true \
            -V code-block-font-size="\footnotesize" \
            --number-sections \
            --highlight-style=pygments
        ;;
    minimal)
        pandoc "$INPUT" -o "$OUTPUT" \
            --pdf-engine=pdflatex \
            -V geometry:margin=1in \
            -V fontsize=11pt \
            -V linkcolor=blue \
            -V toc=true \
            --number-sections
        ;;
    *)
        echo "Unknown style: $STYLE"
        echo "Available: executive, technical, minimal"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
    echo "Generated: $OUTPUT ($SIZE)"
else
    echo "Error generating PDF"
    exit 1
fi
