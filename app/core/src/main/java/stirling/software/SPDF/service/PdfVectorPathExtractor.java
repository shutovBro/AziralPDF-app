package stirling.software.SPDF.service;

import java.awt.geom.Point2D;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.contentstream.PDFGraphicsStreamEngine;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImage;

import lombok.extern.slf4j.Slf4j;

import stirling.software.SPDF.model.json.PdfJsonVectorPath;

/**
 * Read-only pass that groups content-stream path-painting operations into discrete vector objects
 * with a PDF-space bounding box. Foundation for Stage 3 (d) vector-object select/delete;
 * intentionally NOT wired into the conversion pipeline yet.
 *
 * <p>The path-construction callbacks (moveTo/lineTo/curveTo/appendRectangle) receive coordinates
 * already transformed by the engine. For a bare {@link PDFGraphicsStreamEngine} (no render scaling)
 * that space equals PDF user space (points, bottom-left origin), matching the image extractor
 * inside {@code PdfJsonConversionService}. VERIFY against the active PDFBox version before relying
 * on exact coordinates (see design doc M2 open questions).
 *
 * <p>v1 limitations: one bounding box per painting op (a complex logo built from many subpaths
 * under one fill becomes one box); no colour extraction yet; clipping paths (endPath) are not
 * emitted as deletable objects.
 */
@Slf4j
public class PdfVectorPathExtractor extends PDFGraphicsStreamEngine {

    private final PDPage page;
    private final int pageNumber;
    private final List<PdfJsonVectorPath> paths = new ArrayList<>();

    private double minX = Double.POSITIVE_INFINITY;
    private double minY = Double.POSITIVE_INFINITY;
    private double maxX = Double.NEGATIVE_INFINITY;
    private double maxY = Double.NEGATIVE_INFINITY;
    private boolean hasPoints = false;
    private Point2D currentPoint = new Point2D.Float();
    private int sequence = 0;

    public PdfVectorPathExtractor(PDPage page, int pageNumber) {
        super(page);
        this.page = page;
        this.pageNumber = pageNumber;
    }

    /** Parses the page content stream and returns the extracted vector objects. */
    public List<PdfJsonVectorPath> extract() throws IOException {
        processPage(page);
        return paths;
    }

    private void accumulate(double x, double y) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasPoints = true;
    }

    @Override
    public void appendRectangle(Point2D p0, Point2D p1, Point2D p2, Point2D p3) throws IOException {
        accumulate(p0.getX(), p0.getY());
        accumulate(p1.getX(), p1.getY());
        accumulate(p2.getX(), p2.getY());
        accumulate(p3.getX(), p3.getY());
        currentPoint = p0;
    }

    @Override
    public void moveTo(float x, float y) throws IOException {
        accumulate(x, y);
        currentPoint = new Point2D.Float(x, y);
    }

    @Override
    public void lineTo(float x, float y) throws IOException {
        accumulate(x, y);
        currentPoint = new Point2D.Float(x, y);
    }

    @Override
    public void curveTo(float x1, float y1, float x2, float y2, float x3, float y3)
            throws IOException {
        accumulate(x1, y1);
        accumulate(x2, y2);
        accumulate(x3, y3);
        currentPoint = new Point2D.Float(x3, y3);
    }

    @Override
    public Point2D getCurrentPoint() throws IOException {
        return currentPoint;
    }

    @Override
    public void closePath() throws IOException {
        // Subpath closed; geometry already accumulated.
    }

    @Override
    public void endPath() throws IOException {
        // Path consumed for clipping or discarded (n operator): not a visible
        // object. Drop the accumulated geometry without emitting.
        reset();
    }

    @Override
    public void strokePath() throws IOException {
        flush("stroke");
    }

    @Override
    public void fillPath(int windingRule) throws IOException {
        flush("fill");
    }

    @Override
    public void fillAndStrokePath(int windingRule) throws IOException {
        flush("fillStroke");
    }

    @Override
    public void shadingFill(COSName shadingName) throws IOException {
        // Shading fills paint the current clip region, not a constructed path.
    }

    @Override
    public void clip(int windingRule) throws IOException {
        // Clip intent is realised by the following endPath(); nothing to record.
    }

    @Override
    public void drawImage(PDImage pdImage) throws IOException {
        // Images are handled by the dedicated image extractor.
    }

    private void flush(String paintType) {
        if (!hasPoints) {
            reset();
            return;
        }
        PdfJsonVectorPath path =
                PdfJsonVectorPath.builder()
                        .id(pageNumber + "-vector-" + sequence++)
                        .pageNumber(pageNumber)
                        .paintType(paintType)
                        .left((float) minX)
                        .right((float) maxX)
                        .top((float) maxY)
                        .bottom((float) minY)
                        .x((float) minX)
                        .y((float) minY)
                        .width((float) (maxX - minX))
                        .height((float) (maxY - minY))
                        .deleted(false)
                        .build();
        paths.add(path);
        reset();
    }

    private void reset() {
        minX = Double.POSITIVE_INFINITY;
        minY = Double.POSITIVE_INFINITY;
        maxX = Double.NEGATIVE_INFINITY;
        maxY = Double.NEGATIVE_INFINITY;
        hasPoints = false;
    }
}
