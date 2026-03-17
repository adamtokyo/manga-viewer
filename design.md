Manga Gallery app

Please create a manga gallery app using client-side JavaScript. It will display images from the same directory as the app files starting at 000.avif and increasing sequentially.

The app should have a smooth, intuitive user interface that uses clear visual feedback rather than words to guide the user. The purpose of the app is viewing manga, so it should stay out of the way as much as possible.

On load, the app should check localStorage to see if there is a stored position from a previous session. If so, it should load the corresponding avif file. Otherwise, it should start at 000.avif.

Every time the app switches to display a new image, it should update localStorage to make sure it remembers where the user was.

On slow connections the image could take a few seconds to come in, so display a loading indicator until it is ready.

The image should be displayed at the maximum size that will fit the browser viewport. All the images have aspect ratio 2:3, so it’s not necessary to load the image to calculate the display dimensions.

Once the first image is loaded, overlay a looping animation to indicate that the user can tap the left of the screen or swipe left to go to the next image. Also display an icon in the  top right that can be used to switch to full-screen mode. If the current image is not the first image, display an icon in the bottom right that looks like a fast-forward button and can be used to immediately return to 000.avif.

Images are numbered sequentially, so the next image after 000.avif is 001.avif, and so on.

After 5 seconds the overlaid animation and icons should disappear so the image can be seen in full.

The following controls should be implemented:

1. Pinch to zoom  
2. Scroll to zoom  
3. When zoomed, touch-drag or mouse-drag to pan  
4. When zoomed, cursor keys to pan  
5. When not zoomed, swipe right to go to next image, swipe left to go to previous image. Swiping to change image should cause the current image to move with the touch point and the next/previous image to appear “underneath”.  
6. When not zoomed, left cursor key for next image, right cursor key for previous image  
7. When the last image has been reached (detected by a 404 error when attempting to fetch the next image), the UI should indicate it by displaying a “No entry”-style icon when the user tries to go to the next image.  
8. Tap or click the top 1/5th of the viewport to display the icon to enter/leave fullscreen. This should also flash the responsive area for a moment to give visual feedback that the user can understand.  
9. Tap or click the enter/leave fullscreen icon to enter/leave fullscreen.  
10. Tap or click the bottom 1/5th of the viewport to display the fast-forward icon to go back to the beginning. This should also flash the responsive area.  
11. Tap or click the fast-forward icon to go directly to 000.avif.  
12. Tap or click the left third of the middle 3/5th of the viewport to go to the next image. This should briefly flash the responsive area and then perform a very fast 0.2 second animation to the next image.  
13. Tap or click the right third of the middle 3/5th of the viewport to go to the previous image.

The app should perform very aggressive readahead and render-ahead to ensure a smooth wait-free experience. Maybe keep 20 or so compressed images and 3 or so decoded images cached and ready to display.

The app should function correctly in latest versions of Chrome and Safari on mobile and desktop.