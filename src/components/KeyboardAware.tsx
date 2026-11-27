import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, Platform, ScrollView, ScrollViewProps, TextInput, View } from 'react-native';

// The app draws edge-to-edge on Android, so the window no longer shrinks when
// the keyboard opens and fields near the bottom end up hidden behind it. These
// helpers add empty space under the scrollable content (as much as the keyboard
// overlaps the scroll view) and scroll the focused field to just above the
// keyboard. Plain JS, so it ships as an over-the-air update.

const GAP = 24; // space left between the focused field and the keyboard

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

type Rect = { x: number; y: number; width: number; height: number };

const measureInWindow = (node: any) =>
  new Promise<Rect | null>(resolve => {
    if (!node?.measureInWindow) return resolve(null);
    node.measureInWindow((x: number, y: number, width: number, height: number) => resolve({ x, y, width, height }));
  });

const measureLayout = (node: any, relativeTo: any) =>
  new Promise<Rect | null>(resolve => {
    if (!node?.measureLayout || !relativeTo) return resolve(null);
    node.measureLayout(
      relativeTo,
      (x: number, y: number, width: number, height: number) => resolve({ x, y, width, height }),
      () => resolve(null),
    );
  });

/** Accepts a ScrollView, a FlatList or a Reanimated ScrollView ref and returns the underlying ScrollView. */
function resolveScrollView(ref: any): any {
  if (!ref) return null;
  if (typeof ref.getInnerViewRef === 'function') return ref;
  const inner = ref.getScrollResponder?.() ?? ref.getNode?.();
  return inner && typeof inner.getInnerViewRef === 'function' ? inner : null;
}

/** Top edge of the keyboard in window coordinates. */
function keyboardTop(e: KeyboardEvent) {
  const { screenY, height } = e.endCoordinates;
  return screenY > 0 ? screenY : Dimensions.get('window').height - height;
}

/**
 * Keeps the focused text field of a scrollable screen visible above the keyboard.
 * Render `<View style={{ height: space }} onLayout={onSpaceLayout} />` as the
 * last child of the scroll content (or as a FlatList's ListFooterComponent).
 */
export function useKeyboardSpace(scrollRef: React.RefObject<any>) {
  const [space, setSpace] = useState(0);
  const spaceRef = useRef(0);
  const kbTop = useRef<number | null>(null);
  const pendingScroll = useRef(false);
  const lastFocused = useRef<any>(null);

  const scrollToFocused = useCallback(async () => {
    const scroll = resolveScrollView(scrollRef.current);
    const input = TextInput.State.currentlyFocusedInput?.();
    const top = kbTop.current;
    if (!scroll || !input || top == null) return;

    const [viewport, field, inContent] = await Promise.all([
      measureInWindow(scroll.getNativeScrollRef?.() ?? scroll),
      measureInWindow(input),
      measureLayout(input, scroll.getInnerViewRef()),
    ]);
    if (!viewport || !field || !inContent) return;

    const visibleTop = viewport.y + GAP;
    const visibleBottom = Math.min(viewport.y + viewport.height, top) - GAP;
    // Fields taller than the visible area: show their top.
    const fieldBottom = Math.min(field.y + field.height, field.y + (visibleBottom - visibleTop));

    let delta = 0;
    if (fieldBottom > visibleBottom) delta = fieldBottom - visibleBottom;
    else if (field.y < visibleTop) delta = field.y - visibleTop;
    if (Math.abs(delta) < 1) return;

    const currentOffset = inContent.y - (field.y - viewport.y);
    scroll.scrollTo({ x: 0, y: Math.max(0, currentOffset + delta), animated: true });
  }, [scrollRef]);

  useEffect(() => {
    let focusPoll: ReturnType<typeof setInterval> | undefined;

    const show = Keyboard.addListener(SHOW_EVENT, async e => {
      kbTop.current = keyboardTop(e);
      const scroll = resolveScrollView(scrollRef.current);
      const viewport = await measureInWindow(scroll?.getNativeScrollRef?.() ?? scroll);
      const overlap = viewport && kbTop.current != null
        ? Math.max(0, viewport.y + viewport.height - kbTop.current)
        : e.endCoordinates.height;

      lastFocused.current = TextInput.State.currentlyFocusedInput?.();
      if (Math.round(spaceRef.current) === Math.round(overlap)) {
        // Same height: no new layout pass is coming, so scroll right away.
        requestAnimationFrame(scrollToFocused);
      } else {
        pendingScroll.current = true;
        spaceRef.current = overlap;
        setSpace(overlap);
      }

      // Moving to another field while the keyboard stays open fires no
      // keyboard event, so watch which field has focus.
      clearInterval(focusPoll);
      focusPoll = setInterval(() => {
        const focused = TextInput.State.currentlyFocusedInput?.();
        if (focused && focused !== lastFocused.current) {
          lastFocused.current = focused;
          scrollToFocused();
        }
      }, 250);
    });

    const hide = Keyboard.addListener(HIDE_EVENT, () => {
      kbTop.current = null;
      lastFocused.current = null;
      pendingScroll.current = false;
      clearInterval(focusPoll);
      spaceRef.current = 0;
      setSpace(0);
    });

    return () => {
      show.remove();
      hide.remove();
      clearInterval(focusPoll);
    };
  }, [scrollRef, scrollToFocused]);

  // The extra space has been laid out, so the scroll view can now scroll far
  // enough to lift fields at the very bottom of the form.
  const onSpaceLayout = useCallback(() => {
    if (pendingScroll.current) {
      pendingScroll.current = false;
      scrollToFocused();
    }
  }, [scrollToFocused]);

  return { space, onSpaceLayout };
}

/**
 * Drop-in replacement for ScrollView on screens with text fields: the focused
 * field is never hidden behind the keyboard, and buttons respond on the first
 * tap while the keyboard is open.
 */
const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(
  { children, keyboardShouldPersistTaps = 'handled', ...props },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);
  const { space, onSpaceLayout } = useKeyboardSpace(scrollRef);

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
      <View style={{ height: space }} onLayout={onSpaceLayout} />
    </ScrollView>
  );
});

export default KeyboardAwareScrollView;
