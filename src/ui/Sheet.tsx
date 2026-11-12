import React, { useContext, useEffect, useRef } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { Overlay } from './Overlay';
import { SheetFrame, type SheetFrameProps } from './SheetFrame';

/**
 * A bottom sheet: grabber, scrim, Android back and a pull down close it; it
 * stays above the keyboard. Drawn in the KitHost's layer, above every screen,
 * so it also closes when its own screen loses focus to another.
 */
export function Sheet(props: SheetFrameProps) {
  const navigation = useContext(NavigationContext);
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;

  useEffect(() => {
    if (!props.visible || !navigation) return;
    return navigation.addListener('blur', () => onClose.current());
  }, [props.visible, navigation]);

  return (
    <Overlay layer="sheet" modal={props.visible}>
      <SheetFrame {...props} />
    </Overlay>
  );
}
