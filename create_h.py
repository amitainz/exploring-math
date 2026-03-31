from PIL import Image

# Create a 10x10 RGB image
img = Image.new('RGB', (10, 10), "white")
pixels = img.load()

# Define the 5 edges of the H
for y in range(10):
    for x in range(10):
        if x < 2 and y < 5: pixels[x,y] = (255, 0, 0)      # Top Left
        if x < 2 and y >= 5: pixels[x,y] = (0, 255, 0)     # Bottom Left
        if x > 7 and y < 5: pixels[x,y] = (255, 255, 0)    # Top Right
        if x > 7 and y >= 5: pixels[x,y] = (255, 0, 255)   # Bottom Right
        if 4 <= y <= 5 and 2 <= x <= 7: pixels[x,y] = (0, 0, 255) # Bar

img.save('h_pixel.png')