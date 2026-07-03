package stirling.software.SPDF.model.json;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PdfJsonPage {

    private Integer pageNumber;
    private Float width;
    private Float height;
    private Integer rotation;

    @Builder.Default private List<PdfJsonTextElement> textElements = new ArrayList<>();
    @Builder.Default private List<PdfJsonImageElement> imageElements = new ArrayList<>();
    @Builder.Default private List<PdfJsonAnnotation> annotations = new ArrayList<>();

    /** Serialized representation of the page resources dictionary. */
    private PdfJsonCosValue resources;

    /** Raw content streams associated with the page, preserved for lossless round-tripping. */
    @Builder.Default private List<PdfJsonStream> contentStreams = new ArrayList<>();

    /**
     * Vector objects extracted for Stage 3 (d) select/delete editing. Nullable; only populated when
     * the editor requested vector-path extraction. Entries with {@code deleted=true} and a valid
     * token range are omitted from the regenerated vector layer.
     */
    private List<PdfJsonVectorPath> vectorPaths;

    /**
     * When true, the editor has structurally changed images on this page (added, removed, or moved)
     * so the preserved content stream can no longer be patched in place. Forces the JSON&rarr;PDF
     * rebuild to regenerate this page's content from the model while keeping vector graphics.
     */
    private Boolean regenerateContent;
}
