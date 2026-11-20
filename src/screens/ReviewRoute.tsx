import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import ReviewScreen from './ReviewScreen';

/**
 * Review as a pushed route. The screen loads only while it is in front, so a
 * tracker's history opened from one of its rows does not leave it reading
 * underneath, and coming back refreshes it.
 */
export default function ReviewRoute() {
  return <ReviewScreen active={useIsFocused()} />;
}
