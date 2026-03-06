import type { FC } from "react";

export interface ModalIrrigadorProps {
  closeModal: () => void;
  onSuccess?: () => void;
}

export const ModalIrrigador: FC<ModalIrrigadorProps>;
