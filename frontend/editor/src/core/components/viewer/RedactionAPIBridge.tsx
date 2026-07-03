import { useEffect, useImperativeHandle, useRef } from "react";
import { useRedaction as useEmbedPdfRedaction } from "@embedpdf/plugin-redaction/react";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { useRedaction } from "@app/contexts/RedactionContext";
import { useActiveDocumentId } from "@app/components/viewer/useActiveDocumentId";
import { useAnnotationCapability } from "@embedpdf/plugin-annotation/react";
import { useDocumentReady } from "@app/components/viewer/hooks/useDocumentReady";

/**
 * Bridges between the EmbedPDF redaction plugin and the Stirling-PDF RedactionContext.
 * Uses the unified redaction mode (toggleRedact/enableRedact/endRedact).
 */
export function RedactionAPIBridge() {
  const activeDocumentId = useActiveDocumentId();
  const documentReady = useDocumentReady();

  // Don't render the inner component until we have a valid document ID and document is ready
  if (!activeDocumentId || !documentReady) {
    return null;
  }

  return <RedactionAPIBridgeInner documentId={activeDocumentId} />;
}

function RedactionAPIBridgeInner({ documentId }: { documentId: string }) {
  const { state, provides: redactionProvides } =
    useEmbedPdfRedaction(documentId);
  const { provides: annotationProvides } = useAnnotationCapability();
  const {
    redactionApiRef,
    setPendingCount,
    setActiveType,
    setIsRedacting,
    setBridgeReady,
    manualRedactColor,
  } = useRedaction();

  // Mark bridge as ready on mount, not ready on unmount
  useEffect(() => {
    setBridgeReady(true);
    return () => {
      setBridgeReady(false);
    };
  }, [setBridgeReady]);

  // Sync EmbedPDF state to our context
  useEffect(() => {
    if (state) {
      setPendingCount(state.pendingCount ?? 0);
      setActiveType(state.activeType ?? null);
      setIsRedacting(state.isRedacting ?? false);
    }
  }, [state, setPendingCount, setActiveType, setIsRedacting]);

  // Track the add-order of pending redactions so the undo button can step the
  // most recent one back (the redaction plugin keeps these out of the
  // annotation history, so plain undo cannot reach them).
  const pendingOrderRef = useRef<{ page: number; id: string }[]>([]);
  useEffect(() => {
    const provides = redactionProvides as any;
    if (!provides?.onRedactionEvent) return;
    const unsubscribe = provides.onRedactionEvent((event: any) => {
      if (event?.documentId && event.documentId !== documentId) return;
      if (event?.type === "add" && Array.isArray(event.items)) {
        for (const item of event.items) {
          if (item?.id !== undefined && item?.page !== undefined) {
            pendingOrderRef.current.push({ page: item.page, id: item.id });
          }
        }
      } else if (event?.type === "remove") {
        pendingOrderRef.current = pendingOrderRef.current.filter(
          (entry) => !(entry.page === event.page && entry.id === event.id),
        );
      } else if (event?.type === "clear" || event?.type === "commit") {
        pendingOrderRef.current = [];
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [redactionProvides, documentId]);

  // Synchronize manual redaction color with EmbedPDF
  // Manual redaction uses the 'redact' annotation tool internally
  useEffect(() => {
    const annotationApi = annotationProvides as any;
    if (annotationApi?.setToolDefaults) {
      annotationApi.setToolDefaults("redact", {
        type: PdfAnnotationSubtype.REDACT,
        strokeColor: manualRedactColor,
        color: manualRedactColor,
        overlayColor: manualRedactColor,
        fillColor: manualRedactColor,
        interiorColor: manualRedactColor,
        backgroundColor: manualRedactColor,
        opacity: 1,
      });
    }
  }, [annotationProvides, manualRedactColor]);

  // Expose the EmbedPDF API through our context's ref
  useImperativeHandle(
    redactionApiRef,
    () => ({
      toggleRedact: () => {
        redactionProvides?.toggleRedact();
      },
      enableRedact: () => {
        redactionProvides?.enableRedact();
      },
      isRedactActive: () => {
        return redactionProvides?.isRedactActive() ?? false;
      },
      endRedact: () => {
        redactionProvides?.endRedact();
      },
      // Common methods
      commitAllPending: () => {
        redactionProvides?.commitAllPending();
        // Don't set redactionsApplied here - it should only be set after the file is saved
        // The save operation in applyChanges will handle setting/clearing this flag
      },
      getActiveType: () => state?.activeType ?? null,
      getPendingCount: () => state?.pendingCount ?? 0,
      undoLastPending: () => {
        const provides = redactionProvides as any;
        if (!provides?.removePending) return false;
        let target =
          pendingOrderRef.current[pendingOrderRef.current.length - 1];
        if (!target) {
          // Fallback for pending redactions added before this listener attached:
          // derive the most recent one from current state (highest page last).
          const pending = (state as any)?.pending as
            | Record<number, Array<{ id: string; page?: number }>>
            | undefined;
          if (pending) {
            const pages = Object.keys(pending)
              .map(Number)
              .sort((a, b) => a - b);
            for (let i = pages.length - 1; i >= 0 && !target; i -= 1) {
              const items = pending[pages[i]];
              if (items && items.length > 0) {
                const item = items[items.length - 1];
                target = { page: item.page ?? pages[i], id: item.id };
              }
            }
          }
        }
        if (target) {
          provides.removePending(target.page, target.id);
          // The resulting "remove" event prunes pendingOrderRef.
          return true;
        }
        return false;
      },
    }),
    [redactionProvides, state],
  );

  return null;
}
