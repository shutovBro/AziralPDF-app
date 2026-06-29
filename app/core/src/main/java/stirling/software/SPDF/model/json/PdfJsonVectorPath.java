package stirling.software.SPDF.model.json;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single vector object (a path-painting operation) extracted from a page's
 * content stream. Foundation for Stage 3 (d) vector-object select/delete.
 *
 * <p>Geometry is in PDF user space (points, bottom-left origin), mirroring {@link
 * PdfJsonImageElement} so the frontend can reuse the same bounds-to-CSS helpers.
 * {@code deleted} is set by the editor; the regenerate path omits deleted paths.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PdfJsonVectorPath {

    private String id;
    private Integer pageNumber;
    /** "stroke" | "fill" | "fillStroke" | "clip" | "none". */
    private String paintType;
    private Integer windingRule;
    private Float x;
    private Float y;
    private Float width;
    private Float height;
    private Float left;
    private Float right;
    private Float top;
    private Float bottom;
    private PdfJsonTextColor strokeColor;
    private PdfJsonTextColor fillColor;
    private Boolean deleted;
    /** Inclusive token index range of this path within its source content stream. */
    private Integer opIndexStart;
    private Integer opIndexEnd;
}
