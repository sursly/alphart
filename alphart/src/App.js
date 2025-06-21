import React, { useState, useRef } from 'react';

// Main App component
const App = () => {
    // State variables
    const [imageSrc, setImageSrc] = useState(null); // Stores the URL of the uploaded image
    const [asciiArt, setAsciiArt] = useState(''); // Stores the generated ASCII art string
    const [isLoading, setIsLoading] = useState(false); // Indicates if conversion is in progress
    const [asciiWidth, setAsciiWidth] = useState(120); // Desired character width for the ASCII art output
    const [message, setMessage] = useState(''); // General messages to the user
    const [isModalOpen, setIsModalOpen] = useState(false); // State for the custom modal
    const [modalContent, setModalContent] = useState(''); // Content for the custom modal
    const [invertColors, setInvertColors] = useState(false); // State for color inversion toggle
    const [useAlphanumericOnly, setUseAlphanumericOnly] = useState(false); // New state for alphanumeric characters toggle
    const [imageDescription, setImageDescription] = useState(''); // New state for generated image description
    const [isDescribingImage, setIsDescribingImage] = useState(false); // Loading state for image description

    // Refs for accessing DOM elements
    const canvasRef = useRef(null); // Ref to the hidden canvas element
    const fileInputRef = useRef(null); // Ref to the file input element

    // ASCII character set, ordered from lightest to darkest visual density
    // This set includes a mix of characters and punctuation.
    const REVERSED_ALL_ASCII_CHARS = [
        ' ', '.', ',', ':', ';', '+', '*', '?', '%', 'S', '#', '@'
    ];

    // Alphanumeric ASCII character set, ordered from lightest to darkest visual density
    // This set contains only letters and numbers for a different stylistic effect.
    const REVERSED_ALPHANUMERIC_CHARS = [
        ' ', '.', '1', 'l', 't', 'c', 'e', 's', 'u', 'd', 'h', 'k', 'm', '0', '8', 'M', 'W'
    ];


    /**
     * Handles file selection by the user.
     * Reads the selected image and sets it as the image source.
     * @param {Object} event - The change event from the file input.
     */
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setMessage(''); // Clear previous messages
            setAsciiArt(''); // Clear previous ASCII art
            setImageDescription(''); // Clear previous description
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageSrc(reader.result); // Set the image source for display and processing
            };
            reader.onerror = () => {
                showModal('Error reading file. Please try again.');
            };
            reader.readAsDataURL(file); // Read file as Data URL
        }
    };

    /**
     * Converts the uploaded image to ASCII art.
     * This function is triggered by the 'Convert' button.
     */
    const convertImageToAscii = () => {
        if (!imageSrc) {
            showModal('Please upload an image first.');
            return;
        }

        setIsLoading(true); // Start loading indicator
        setAsciiArt(''); // Clear previous output
        setMessage('Converting image...');

        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Required for some image origins on canvas
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // Set canvas dimensions to the image dimensions for initial drawing
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image onto the canvas
            ctx.drawImage(img, 0, 0, img.width, img.height);

            // Calculate the dimensions for the ASCII art output
            // Monospace characters are typically taller than they are wide.
            // A common character aspect ratio (width/height) for monospace fonts is around 0.5.
            const charAspectRatio = 0.5; // Adjust this value based on your preferred font's actual ratio

            const originalWidth = img.width;
            const originalHeight = img.height;

            // Calculate new height based on desired ASCII width and character aspect ratio
            const newHeight = Math.floor((originalHeight / originalWidth) * asciiWidth * charAspectRatio);

            // Get image data from the canvas
            const imageData = ctx.getImageData(0, 0, originalWidth, originalHeight);
            const data = imageData.data; // Raw pixel data (R, G, B, A for each pixel)

            let ascii = '';

            // Determine which character set to use based on the toggle
            const currentAsciiCharSet = useAlphanumericOnly
                ? REVERSED_ALPHANUMERIC_CHARS
                : REVERSED_ALL_ASCII_CHARS;

            // Loop through the image pixels, sampling them to fit the ASCII art dimensions
            for (let y = 0; y < newHeight; y++) {
                for (let x = 0; x < asciiWidth; x++) {
                    // Calculate source pixel coordinates for sampling
                    const sourceX = Math.floor((x / asciiWidth) * originalWidth);
                    const sourceY = Math.floor((y / newHeight) * originalHeight);

                    // Get the index of the top-left corner of the pixel in the data array
                    const pixelIndex = (sourceY * originalWidth + sourceX) * 4; // *4 for R, G, B, A

                    // Get RGB values (we'll ignore alpha for intensity)
                    const r = data[pixelIndex];
                    const g = data[pixelIndex + 1];
                    const b = data[pixelIndex + 2];

                    // Convert to grayscale using luminance method (more accurate than simple average)
                    // Luminance: 0.2126*R + 0.7152*G + 0.0722*B
                    let grayscale = Math.floor(0.2126 * r + 0.7152 * g + 0.0722 * b);

                    // Apply color inversion if the toggle is active
                    if (invertColors) {
                        grayscale = 255 - grayscale; // Invert the grayscale value
                    }

                    // Map grayscale value (0-255) to an index in the selected ASCII character set
                    const charIndex = Math.floor((grayscale / 255) * (currentAsciiCharSet.length - 1));

                    // Append the corresponding ASCII character
                    ascii += currentAsciiCharSet[charIndex];
                }
                ascii += '\n'; // Add newline at the end of each row
            }

            setAsciiArt(ascii); // Set the generated ASCII art
            setMessage('Conversion complete!');
            setIsLoading(false); // Stop loading indicator
        };
        img.onerror = () => {
            showModal('Could not load image. Please check the file format or try another image.');
            setIsLoading(false);
            setMessage('Image loading failed.');
        };
        img.src = imageSrc; // Load the image from the source URL
    };

    /**
     * Calls the Gemini API to describe the uploaded image.
     */
    const describeImageWithGemini = async () => {
        if (!imageSrc) {
            showModal('Please upload an image first to describe it.');
            return;
        }

        setIsDescribingImage(true);
        setImageDescription('Generating description...');

        try {
            // Convert Data URL to base64 string required by Gemini API
            const base64ImageData = imageSrc.split(',')[1];
            const mimeType = imageSrc.split(';')[0].split(':')[1];

            let chatHistory = [];
            const prompt = "Describe this image in detail. Focus on the main subjects, objects, colors, and overall scene. Provide a concise and creative caption as well.";
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64ImageData
                                }
                            }
                        ]
                    }
                ],
            };
            const apiKey = ""; // Canvas will provide this at runtime
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setImageDescription(text);
            } else {
                setImageDescription('Could not generate description. Please try again.');
                console.error("Gemini API response structure unexpected:", result);
            }
        } catch (error) {
            setImageDescription('Error generating description: ' + error.message);
            console.error("Error calling Gemini API:", error);
        } finally {
            setIsDescribingImage(false);
        }
    };


    /**
     * Downloads the generated ASCII art as a plain text file.
     */
    const downloadAsciiArt = () => {
        if (!asciiArt) {
            showModal('No ASCII art to download. Please convert an image first.');
            return;
        }

        const blob = new Blob([asciiArt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ascii_art.txt'; // Default filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up the URL object
    };

    /**
     * Shows a custom modal with a given message.
     * @param {string} content - The message to display in the modal.
     */
    const showModal = (content) => {
        setModalContent(content);
        setIsModalOpen(true);
    };

    /**
     * Hides the custom modal.
     */
    const hideModal = () => {
        setIsModalOpen(false);
        setModalContent('');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 flex flex-col items-center font-inter">
           
            <h1 className="text-4xl font-bold text-blue-400 mb-8 rounded-lg shadow-lg p-3 bg-gray-800">
                Image to ASCII Art Converter
            </h1>

            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Panel: Image Upload and Settings */}
                    <div className="flex-1 flex flex-col items-center">
                        <label
                            htmlFor="file-upload"
                            className="w-full p-4 border-2 border-dashed border-blue-500 text-blue-300 rounded-lg cursor-pointer hover:bg-blue-900 transition-colors duration-200 flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-lg font-semibold">Upload Black & White Image</span>
                            <span className="text-sm text-gray-400">(JPG, PNG, GIF)</span>
                            <input
                                id="file-upload"
                                type="file"
                                accept="image/png, image/jpeg, image/gif"
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                className="hidden"
                            />
                        </label>
                        {imageSrc && (
                            <div className="mt-6 p-2 bg-gray-700 rounded-lg shadow-inner">
                                <h3 className="text-gray-300 mb-2">Preview:</h3>
                                <img
                                    src={imageSrc}
                                    alt="Uploaded"
                                    className="max-w-full h-auto rounded-md border border-gray-600"
                                    style={{ maxHeight: '200px' }}
                                    onError={(e) => { e.target.src = "https://placehold.co/200x150/5C5C5C/FFFFFF?text=Image+Load+Error"; }}
                                />
                            </div>
                        )}

                        <div className="mt-6 w-full">
                            <label htmlFor="ascii-width" className="block text-gray-300 text-sm font-semibold mb-2">
                                ASCII Art Width (characters):
                            </label>
                            <input
                                id="ascii-width"
                                type="number"
                                min="30"
                                max="300"
                                value={asciiWidth}
                                onChange={(e) => setAsciiWidth(Math.max(30, Math.min(300, parseInt(e.target.value) || 120)))}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            />
                        </div>

                        {/* Invert Colors Toggle */}
                        <div className="mt-4 w-full flex items-center">
                            <input
                                id="invert-colors"
                                type="checkbox"
                                checked={invertColors}
                                onChange={(e) => setInvertColors(e.target.checked)}
                                className="h-5 w-5 text-blue-600 rounded border-gray-600 focus:ring-blue-500 bg-gray-700 cursor-pointer"
                            />
                            <label htmlFor="invert-colors" className="ml-2 text-gray-300 text-sm font-semibold cursor-pointer">
                                Invert Colors (Dark Mode)
                            </label>
                        </div>

                        {/* Alphanumeric Only Toggle */}
                        <div className="mt-2 w-full flex items-center">
                            <input
                                id="alphanumeric-only"
                                type="checkbox"
                                checked={useAlphanumericOnly}
                                onChange={(e) => setUseAlphanumericOnly(e.target.checked)}
                                className="h-5 w-5 text-blue-600 rounded border-gray-600 focus:ring-blue-500 bg-gray-700 cursor-pointer"
                            />
                            <label htmlFor="alphanumeric-only" className="ml-2 text-gray-300 text-sm font-semibold cursor-pointer">
                                Use Alphanumeric Characters Only
                            </label>
                        </div>

                        <button
                            onClick={convertImageToAscii}
                            disabled={isLoading || !imageSrc}
                            className={`mt-8 w-full py-3 px-6 rounded-lg text-lg font-bold transition-all duration-300 shadow-lg
                                ${isLoading || !imageSrc
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-105 active:scale-95'
                                }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Converting...
                                </div>
                            ) : (
                                'Convert to ASCII Art'
                            )}
                        </button>

                        {/* New Gemini API integration button */}
                        <button
                            onClick={describeImageWithGemini}
                            disabled={isDescribingImage || !imageSrc}
                            className={`mt-4 w-full py-3 px-6 rounded-lg text-lg font-bold transition-all duration-300 shadow-lg
                                ${isDescribingImage || !imageSrc
                                    ? 'bg-purple-800 text-purple-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white transform hover:scale-105 active:scale-95'
                                }`}
                        >
                            {isDescribingImage ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Describing...
                                </div>
                            ) : (
                                '✨ Describe Image'
                            )}
                        </button>
                    </div>

                    {/* Right Panel: ASCII Art Output and Image Description */}
                    <div className="flex-1 flex flex-col">
                        <h2 className="text-xl font-semibold text-gray-300 mb-3">ASCII Art Output:</h2>
                        <div className="flex-grow bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-auto shadow-inner mb-6">
                            <pre
                                className="font-mono text-xs leading-none whitespace-pre overflow-x-auto text-lime-400"
                                style={{
                                    lineHeight: '0.8', // Adjust line height for better density
                                    letterSpacing: '-0.5px' // Adjust letter spacing
                                }}
                            >
                                {asciiArt || (
                                    <span className="text-gray-500">
                                        {message || 'Upload an image and click "Convert" to see your ASCII art here.'}
                                    </span>
                                )}
                            </pre>
                        </div>
                        {asciiArt && (
                            <button
                                onClick={downloadAsciiArt}
                                className="mt-4 w-full py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-200 shadow-md transform hover:scale-105 active:scale-95"
                            >
                                Download ASCII Art (.txt)
                            </button>
                        )}

                        {/* New section for Image Description */}
                        <h2 className="text-xl font-semibold text-gray-300 mt-6 mb-3">Image Description:</h2>
                        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-auto shadow-inner min-h-[100px]">
                            <p className="text-gray-300 text-sm">
                                {imageDescription || 'Click "✨ Describe Image" to get an AI-generated description.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Canvas for Image Processing */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

            {/* Custom Modal for alerts */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 shadow-2xl border border-gray-700 max-w-sm w-full text-center">
                        <p className="text-gray-200 text-lg mb-6">{modalContent}</p>
                        <button
                            onClick={hideModal}
                            className="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors duration-200 shadow-lg"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;

