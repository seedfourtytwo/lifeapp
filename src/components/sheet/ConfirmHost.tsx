import React, { useEffect, useState } from 'react';
import { attachConfirmHost, settleConfirm, type SheetRequest } from './confirm';
import ConfirmSheet from './ConfirmSheet';

/**
 * Draws whatever `confirm()` / `notify()` ask. Mounted once at the app root,
 * inside the Paper provider, so the sheet lands in the same portal as every
 * other sheet — and, opening last, above them.
 */
export default function ConfirmHost() {
  // The last request stays in hand while the sheet closes, so its words do not
  // vanish before it has slid away.
  const [request, setRequest] = useState<SheetRequest | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(
    () =>
      attachConfirmHost((next) => {
        if (next) setRequest(next);
        setVisible(next != null);
      }),
    [],
  );

  if (!request) return null;
  return <ConfirmSheet visible={visible} request={request} onAnswer={settleConfirm} />;
}
