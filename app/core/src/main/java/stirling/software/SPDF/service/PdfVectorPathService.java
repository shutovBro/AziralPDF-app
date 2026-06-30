package stirling.software.SPDF.service;

import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

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
                    all.addAll(extractor.extract());
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
}
