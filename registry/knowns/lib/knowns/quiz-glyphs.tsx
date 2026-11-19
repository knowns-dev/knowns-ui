/** @registry name="quiz-glyphs" type="lib" title="Quiz glyphs" description="The small one-style icons of the quiz components: check, cross, clock, plus, trash, arrows, grip, flag, download, upload, restart and spark. 16px, stroke follows currentColor." */
import type { SVGProps } from "react";

type GlyphProps = Omit<SVGProps<SVGSVGElement>, "children" | "d"> & { size?: number };

/** One shared frame: a 16 by 16 grid, a 1.6 stroke with round ends, drawn in the colour of the text around it. */
function frame(d: string, extra?: string) {
  return function Glyph({ size = 16, className, ...rest }: GlyphProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className} {...rest}>
        <path d={d} />
        {extra ? <path d={extra} /> : null}
      </svg>
    );
  };
}

export const CheckGlyph = frame("M3.5 8.5l3 3 6-7");
export const CrossGlyph = frame("M4 4l8 8M12 4l-8 8");
export const PlusGlyph = frame("M8 3.5v9M3.5 8h9");
export const TrashGlyph = frame("M3 4.5h10M6.5 4.5v-1.5h3v1.5M4.5 4.5l.6 8h5.8l.6-8");
export const UpGlyph = frame("M4 9.5l4-4 4 4");
export const DownGlyph = frame("M4 6.5l4 4 4-4");
export const NextGlyph = frame("M3.5 8h9M9 4.5l3.5 3.5L9 11.5");
export const ClockGlyph = frame("M8 3v5l3 1.8", "M8 14a6 6 0 100-12 6 6 0 000 12z");
export const GripGlyph = frame("M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01");
export const FlagGlyph = frame("M4 14V2.5M4 3h7.5l-1.5 2.5 1.5 2.5H4");
export const DownloadGlyph = frame("M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10");
export const UploadGlyph = frame("M8 11V3M4.5 6L8 2.5 11.5 6M3 13.5h10");
export const RestartGlyph = frame("M3 8a5 5 0 105-5H5.5M5.5 1l-2 2 2 2");
export const SparkGlyph = frame("M8 2.5l1.3 3.7 3.7 1.3-3.7 1.3L8 12.5 6.7 8.8 3 7.5l3.7-1.3z");
