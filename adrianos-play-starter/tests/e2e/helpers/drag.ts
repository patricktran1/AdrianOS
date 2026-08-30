import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Drags a draggable element onto a drop zone deterministically.
 *
 * Playwright's `dragTo()` intermittently fails to deliver the drop under
 * parallel load on a slow runner: the game's round counter never advances and
 * the assertion times out. Synthesised pointer movement is not an alternative,
 * because these games use HTML5 drag-and-drop — `mouse.down()` on one element
 * and `mouse.up()` on another fires neither a drag nor a click.
 *
 * So this dispatches the drag sequence itself, sharing one DataTransfer across
 * the events exactly as a browser would. It exercises the same dragstart,
 * dragover and drop handlers the game implements, and only removes the
 * timing nondeterminism.
 *
 * Every game using this pattern also accepts a plain tap on the same element,
 * which is what a child on a touch device gets: HTML5 drag-and-drop never
 * fires from a finger.
 */
export async function dragOnto(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const sourceHandle = await source.elementHandle();
  const targetHandle = await target.elementHandle();
  expect(sourceHandle, "the dragged element should be attached").not.toBeNull();
  expect(targetHandle, "the drop zone should be attached").not.toBeNull();

  await page.evaluate(
    ([from, to]) => {
      const dataTransfer = new DataTransfer();
      const fire = (element: Element, type: string) => {
        element.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })
        );
      };
      fire(from as Element, "dragstart");
      fire(to as Element, "dragover");
      fire(to as Element, "drop");
      fire(from as Element, "dragend");
    },
    [sourceHandle, targetHandle] as const
  );

  await sourceHandle?.dispose();
  await targetHandle?.dispose();
}
