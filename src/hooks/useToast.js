import { useState, useCallback, useRef } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((msg, ok = true) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, ok });
    timerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return { toast, showToast };
}
