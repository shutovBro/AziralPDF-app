package stirling.software.SPDF.service;

import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.pdfparser.PDFStreamParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.ObjectMapper;

import stirling.software.SPDF.model.json.PdfJsonVectorPath;
import stirling.software.common.service.CustomPDFDocumentFactory;

/**
 * Opt-in diagnostic service for Stage 3 (d) vector-object support: runs {@link
 * PdfVectorPathExtractor} over every page and serialises the extracted vector
 * objects as JSON. Read-only and isolated from the main {@code
 * PdfJsonConversionService} pipeline so it cannot affect the live editor while
 * the coordinate model is being validated.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PdfVectorPathService {

    // Path-painting operators: each ends one visible path object, in stream order.
    private static final Set<String> PAINTING_OPS =
            Set.of("S", "s", "f", "F", "f*", "B", "B*", "b", "b*");
    // End-path (clip/no-op): consumes the constructed path without painting it.
    private static final String END_PATH = "n";

    private final CustomPDFDocumentFactory pdfDocumentFactory;
    private final ObjectMapper objectMapper;

    /** Extracts vector path objects from every page and writes them as a JSON array. */
    public void extractVectorPaths(MultipartFile inputFile, OutputStream out) throws IOException {
        List<PdfJsonVectorPath> all = new ArrayList<>();
        try (PDDocument document = pdfDocumentFactory.load(inputFile, true)) {
            int totalPages = document.getNumberOfPages();
            for (int pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                int pageNumber = pageIndex + 1;
                PDPage page = document.getPage(pageIndex);
                try {
                    PdfVectorPathExtractor extractor =
                            new PdfVectorPathExtractor(page, pageNumber);
                    List<PdfJsonVectorPath> pagePaths = extractor.extract();
                    assignTokenRanges(page, pagePaths);
                    all.addAll(pagePaths);
                } catch (IOException | RuntimeException ex) {
                    log.warn(
                            "Vector path extraction failed for page {}: {}",
                            pageNumber,
                            ex.getMessage());
                }
            }
        }
        objectMapper.writeValue(out, all);
    }

    /**
     * Correlates each engine-extracted path with its token range in the page content stream so the
     * deletion path (M4) can skip exactly those tokens. The graphics engine emits one path per
     * painting operator in stream order; a parallel token walk counts the same painting operators
     * (skipping {@code n}/clip), so the Nth painting op's token range maps to the Nth path. The
     * range spans from the token after the previous path boundary to the painting operator
     * (inclusive), which covers this path's construction operands + operator. Form-XObject draws and
     * empty paints can desync the counts; a mismatch is logged and ranges are left unset rather than
     * mis-assigned.
     */
    private void assignTokenRanges(PDPage page, List<PdfJsonVectorPath> paths) {
        if (paths.isEmpty()) {
            return;
        }
        List<int[]> ranges = new ArrayList<>();
        try {
            List<Object> tokens = new PDFStreamParser(page).parse();
            int boundary = 0;
            for (int i = 0; i < tokens.size(); i++) {
                if (!(tokens.get(i) instanceof Operator op)) {
                    continue;
                }
                String name = op.getName();
                if (PAINTING_OPS.contains(name)) {
                    ranges.add(new int[] {boundary, i});
                    boundary = i + 1;
                } else if (END_PATH.equals(name)) {
                    boundary = i + 1;
                }
            }
        } catch (IOException | RuntimeException ex) {
            log.warn("Token-range correlation failed: {}", ex.getMessage());
            return;
        }
        if (ranges.size() != paths.size()) {
            log.warn(
                    "Vector path/token painting-op count mismatch (tokens={}, engine={}); leaving"
                            + " token ranges unset for this page",
                    ranges.size(),
                    paths.size());
            return;
        }
        for (int i = 0; i < paths.size(); i++) {
            paths.get(i).setOpIndexStart(ranges.get(i)[0]);
            paths.get(i).setOpIndexEnd(ranges.get(i)[1]);
        }
    }
}
