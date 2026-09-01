import { useEffect, useState } from "react";

import { useEvent } from "../events/react";
import { usePerf } from "../store";

/**
 * Có nên hiện các số liệu compute pass không.
 *
 * KHÔNG gate theo `backend === "webgpu"` đơn thuần: gần như mọi scene WebGPU đều
 * có `computeCalls: 0` vì compute chỉ chạy khi ứng dụng tự viết compute node.
 * Gate theo backend sẽ dựng thêm một hàng "COMPUTE 0.00ms" vĩnh viễn cho hầu hết
 * người dùng — cao thêm mà không được gì.
 *
 * Điều kiện là ĐÃ THỰC SỰ có dispatch, và latch lại: compute chạy ngắt quãng thì
 * hàng vẫn đứng yên thay vì nhấp nháy. Latch reset khi đổi renderer.
 *
 * Đọc qua event `log` thay vì subscribe store để không kéo theo re-render mỗi
 * nhịp log — cùng cách các component UI khác đang làm.
 */
export function useHasCompute(): boolean {
  const backend = usePerf((state) => state.infos.backend);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    setSeen(false);
  }, [backend]);

  useEvent(
    "log",
    (payload: any) => {
      if (seen) return;
      const [, gl] = payload ?? [];
      if (gl && gl.computeCalls > 0) setSeen(true);
    },
    [seen],
  );

  return backend === "webgpu" && seen;
}
