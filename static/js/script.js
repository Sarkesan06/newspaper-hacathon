let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentLanguageType = null;

// ==================== MULTI-PAGE UPLOAD FUNCTIONALITY ====================
let uploadedFiles = []; // Array to store uploaded files in order
let processedResults = []; // Store page result state after processing

// Handle multiple image uploads
document.getElementById('imageInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    
    // Add new files to uploadedFiles array (avoid duplicates)
    files.forEach(file => {
        uploadedFiles.push(file);
    });
    
    displayUploadedFiles();
});

// Display uploaded files with preview and drag-drop reordering
function displayUploadedFiles() {
    const container = document.getElementById('filesContainer');
    const listSection = document.getElementById('uploadedFilesList');
    
    if (uploadedFiles.length === 0) {
        listSection.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    
    listSection.style.display = 'block';
    container.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
        // Create card element first
        const card = document.createElement('div');
        card.className = 'file-card';
        card.draggable = true;
        card.dataset.index = index;
        
        // Create the card structure with placeholder
        card.innerHTML = `
            <div style="width: 100%; height: 150px; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; color: #999;">
                    <i class="fas fa-image" style="font-size: 2em;"></i>
                    <p>Loading...</p>
                </div>
            </div>
            <div class="file-card-overlay">
                <div class="file-page-number">Page ${index + 1}</div>
                <div class="file-card-controls">
                    <div class="file-drag-hint"><i class="fas fa-arrows-alt"></i> Drag to reorder</div>
                    <div class="file-rotate-group">
                        <button class="file-rotate-btn" onclick="rotateFile(${index}, -90)">
                            <i class="fas fa-rotate-left"></i> Rotate Left
                        </button>
                        <button class="file-rotate-btn" onclick="rotateFile(${index}, 90)">
                            <i class="fas fa-rotate-right"></i> Rotate Right
                        </button>
                    </div>
                    <button class="file-remove-btn" onclick="removeFile(${index})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragleave', handleDragLeave);
        
        container.appendChild(card);
        
        // Read the file and update the card
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = `Page ${index + 1}`;
            img.style.width = '100%';
            img.style.height = '150px';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
            
            // Replace the placeholder with the actual image
            const placeholder = card.querySelector('div[style*="background: #f0f0f0"]');
            if (placeholder) {
                placeholder.replaceWith(img);
            }
        };
        reader.readAsDataURL(file);
    });
}

let draggedElement = null;
let draggedIndex = null;

function handleDragStart(e) {
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedIndex);
}

function handleDragEnd(e) {
    if (this === draggedElement) {
        this.classList.remove('dragging');
    }
    document.querySelectorAll('.file-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    draggedElement = null;
    draggedIndex = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this !== draggedElement && draggedElement) {
        this.classList.add('drag-over');
    }
    return false;
}

function handleDragLeave(e) {
    // Only remove drag-over if we're leaving the element itself
    if (e.target === this || !e.relatedTarget || !this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.classList.remove('drag-over');
    
    if (draggedElement && this !== draggedElement) {
        const fromIndex = draggedIndex;
        const toIndex = parseInt(this.dataset.index);
        
        if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
            // Swap files in array
            const temp = uploadedFiles[fromIndex];
            uploadedFiles[fromIndex] = uploadedFiles[toIndex];
            uploadedFiles[toIndex] = temp;
            
            // Redisplay with new order
            displayUploadedFiles();
        }
    }
    
    return false;
}

// Remove single file
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayUploadedFiles();
}

function rotateFile(index, degrees) {
    const file = uploadedFiles[index];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const image = new Image();
        image.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const radians = degrees * Math.PI / 180;
            const width = image.width;
            const height = image.height;
            if (degrees % 180 !== 0) {
                canvas.width = height;
                canvas.height = width;
            } else {
                canvas.width = width;
                canvas.height = height;
            }
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(radians);
            ctx.drawImage(image, -width / 2, -height / 2);
            canvas.toBlob(function(blob) {
                if (!blob) return;
                const rotatedFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
                uploadedFiles[index] = rotatedFile;
                displayUploadedFiles();
            }, file.type || 'image/png');
        };
        image.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Clear all files
function clearAllImages() {
    uploadedFiles = [];
    document.getElementById('imageInput').value = '';
    displayUploadedFiles();
}

// Process multiple images
async function processMultipleImages() {
    if (uploadedFiles.length === 0) {
        alert('Please upload at least one image!');
        return;
    }
    
    const processBtn = document.getElementById('processBtn');
    const originalBtnText = processBtn.innerHTML;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    processBtn.disabled = true;
    
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    const progressWrapper = document.getElementById('progressWrapper');
    const progressBar = document.getElementById('progressBar');
    const progressLabel = document.getElementById('progressLabel');
    progressWrapper.style.display = 'block';
    progressBar.style.width = '0%';
    progressLabel.textContent = `Starting processing...`;
    resultsContent.innerHTML = '';
    processedResults = [];
    
    try {
        // Process each file
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const pageNumber = i + 1;
            const totalPages = uploadedFiles.length;
            
            // Update progress
            processBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Page ${pageNumber}/${totalPages}...`;
            progressBar.style.width = `${Math.round((pageNumber - 1) / totalPages * 100)}%`;
            progressLabel.textContent = `Processing page ${pageNumber} of ${totalPages}...`;
            
            const formData = new FormData();
            formData.append('image', file);
            formData.append('ocr_lang', document.getElementById('ocrLangSelect').value);
            formData.append('output_lang', document.getElementById('outputLangSelect').value);
            formData.append('generate_audio', document.getElementById('generateAudio').checked);
            formData.append('show_summary', document.getElementById('showSummary').checked);
            formData.append('page_number', pageNumber);
            
            try {
                const response = await fetch('/process_image', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    processedResults[pageNumber - 1] = data.result;
                    displayPageResults(data.result, pageNumber, resultsContent);
                } else {
                    processedResults[pageNumber - 1] = { error: data.error };
                    addErrorResult(pageNumber, data.error, resultsContent);
                }
            } catch (error) {
                processedResults[pageNumber - 1] = { error: 'Error processing page' };
                addErrorResult(pageNumber, 'Error processing page', resultsContent);
            }
        }
        
        progressBar.style.width = '100%';
        progressLabel.textContent = 'Processing completed.';
        resultsDiv.style.display = 'block';
    } catch (error) {
        console.error('Error processing multiple images:', error);
        alert('Error processing images. Please try again.');
        progressLabel.textContent = 'Processing failed.';
    } finally {
        processBtn.innerHTML = originalBtnText;
        processBtn.disabled = false;
    }
}

// Display results for a single page
function displayPageResults(result, pageNumber, container, beforeNode = null) {
    const pageCard = document.createElement('div');
    pageCard.className = 'page-results';
    const pageIndex = pageNumber - 1;
    pageCard.id = `pageResultsCard${pageIndex}`;
    
    let html = `
        <h3>
            <i class="fas fa-file-alt"></i>
            Page <span class="page-badge">${pageNumber}</span>
        </h3>
    `;
    
    // OCR Extraction
    html += `
        <div class="result-card">
            <h4><i class="fas fa-eye"></i> OCR Extraction</h4>
            <textarea id="ocrTextPage${pageIndex}" class="result-textarea">${escapeHtml(result.ocr_text)}</textarea>
            <div class="result-buttons">
                <button class="small-btn" onclick="copyText('ocrTextPage${pageIndex}')"><i class="fas fa-copy"></i> Copy OCR Text</button>
                <button class="small-btn outline" onclick="retranslatePage(${pageIndex})"><i class="fas fa-sync-alt"></i> Re-translate</button>
            </div>
        </div>
    `;
    
    // OCR Confidence
    if (result.ocr_confidence !== undefined) {
        html += `
            <div class="result-card">
                <h4><i class="fas fa-chart-line"></i> OCR Confidence</h4>
                <div class="result-content">Average confidence: ${result.ocr_confidence.toFixed(1)}% | Words: ${result.word_count || 0}</div>
            </div>
        `;
    }
    
    // OCR Audio
    if (result.ocr_audio_file) {
        html += `
            <div class="result-card">
                <h4><i class="fas fa-volume-up"></i> OCR Audio</h4>
                <div class="audio-player">
                    <audio controls style="width: 100%;">
                        <source src="/audio/${encodeURIComponent(result.ocr_audio_file)}" type="audio/mpeg">
                        Your browser does not support the audio element.
                    </audio>
                    <button class="download-btn" onclick="downloadAudio('${result.ocr_audio_file}')">
                        <i class="fas fa-download"></i> Download OCR Audio
                    </button>
                </div>
            </div>
        `;
    }
    
    // Translation
    if (result.translated_text) {
        html += `
            <div class="result-card">
                <h4><i class="fas fa-language"></i> Translation</h4>
                <textarea id="translatedTextPage${pageIndex}" class="result-textarea">${escapeHtml(result.translated_text)}</textarea>
                <div class="result-buttons">
                    <button class="small-btn" onclick="copyText('translatedTextPage${pageIndex}')"><i class="fas fa-copy"></i> Copy Translation</button>
                    <button class="small-btn outline" onclick="retranslatePage(${pageIndex})"><i class="fas fa-redo"></i> Update Translation</button>
                </div>
            </div>
        `;
    }
    
    // Translation Audio
    if (result.translated_audio_file) {
        html += `
            <div class="result-card">
                <h4><i class="fas fa-volume-up"></i> Translation Audio</h4>
                <div class="audio-player">
                    <audio controls style="width: 100%;">
                        <source src="/audio/${encodeURIComponent(result.translated_audio_file)}" type="audio/mpeg">
                        Your browser does not support the audio element.
                    </audio>
                    <button class="download-btn" onclick="downloadAudio('${result.translated_audio_file}')">
                        <i class="fas fa-download"></i> Download Translation Audio
                    </button>
                </div>
            </div>
        `;
    }
    
    // Summary
    if (result.summary) {
        html += `
            <div class="result-card">
                <h4><i class="fas fa-align-left"></i> Summary</h4>
                <div class="result-content">${escapeHtml(result.summary)}</div>
            </div>
        `;
    }
    
    pageCard.innerHTML = html;
    if (beforeNode && beforeNode.parentNode === container) {
        container.insertBefore(pageCard, beforeNode);
    } else {
        container.appendChild(pageCard);
    }
    return pageCard;
}

// Add error result for a page
function addErrorResult(pageNumber, error, container) {
    const errorCard = document.createElement('div');
    errorCard.className = 'page-results';
    errorCard.style.borderLeftColor = '#ff4757';
    errorCard.innerHTML = `
        <h3>
            <i class="fas fa-exclamation-circle"></i>
            Page <span class="page-badge" style="background: #ff4757;">${pageNumber}</span>
        </h3>
        <div class="result-card" style="border-left: 3px solid #ff4757;">
            <p style="color: #ff4757;"><i class="fas fa-times"></i> Error: ${escapeHtml(error)}</p>
        </div>
    `;
    container.appendChild(errorCard);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== END MULTI-PAGE UPLOAD FUNCTIONALITY ====================

// ==================== SEARCHABLE DROPDOWN FUNCTIONALITY ====================

// Initialize searchable dropdowns
function initializeSearchableDropdown(searchInputId, selectId, dropdownId) {
    const searchInput = document.getElementById(searchInputId);
    const select = document.getElementById(selectId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!searchInput || !select || !dropdown) return;
    
    // Populate dropdown on focus
    function populateDropdown() {
        dropdown.innerHTML = '';
        const searchTerm = searchInput.value.toLowerCase();
        
        let hasMatches = false;
        for (let option of select.options) {
            const text = option.text.toLowerCase();
            const originalText = option.text;
            
            // Show options that start with search term or match exactly
            if (searchTerm === '' || text.startsWith(searchTerm) || text.includes(' ' + searchTerm)) {
                hasMatches = true;
                const li = document.createElement('li');
                
                // Highlight the matching part
                let displayText = originalText;
                if (searchTerm !== '') {
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    displayText = originalText.replace(regex, '<strong>$1</strong>');
                }
                
                li.innerHTML = displayText;
                li.dataset.value = option.value;
                
                // Check if this option is currently selected
                if (option.value === select.value) {
                    li.classList.add('highlighted');
                }
                
                li.addEventListener('click', function() {
                    select.value = this.dataset.value;
                    dropdown.style.display = 'none';
                    searchInput.value = '';
                    // Trigger change event
                    select.dispatchEvent(new Event('change'));
                });
                
                dropdown.appendChild(li);
            }
        }
        
        // Show or hide dropdown based on matches
        if (hasMatches && searchInput.value !== '') {
            dropdown.style.display = 'block';
        } else if (searchInput.value === '' && dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        }
    }
    
    // Search input event listeners
    searchInput.addEventListener('input', populateDropdown);
    searchInput.addEventListener('focus', function() {
        if (this.value !== '') {
            populateDropdown();
        }
    });
    
    // Show dropdown when focused and empty
    searchInput.addEventListener('click', function() {
        if (this.value === '') {
            dropdown.innerHTML = '';
            for (let option of select.options) {
                const li = document.createElement('li');
                li.textContent = option.text;
                li.dataset.value = option.value;
                
                if (option.value === select.value) {
                    li.classList.add('highlighted');
                }
                
                li.addEventListener('click', function() {
                    select.value = this.dataset.value;
                    dropdown.style.display = 'none';
                    searchInput.value = '';
                    select.dispatchEvent(new Event('change'));
                });
                
                dropdown.appendChild(li);
            }
            dropdown.style.display = 'block';
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.searchable-select-wrapper')) {
            dropdown.style.display = 'none';
        }
    });
    
    // Handle arrow keys
    searchInput.addEventListener('keydown', function(event) {
        const items = dropdown.querySelectorAll('li');
        const active = dropdown.querySelector('li.highlighted');
        
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (dropdown.style.display === 'none') {
                dropdown.style.display = 'block';
                if (items.length > 0) items[0].classList.add('highlighted');
            } else if (active) {
                const nextItem = active.nextElementSibling;
                if (nextItem) {
                    active.classList.remove('highlighted');
                    nextItem.classList.add('highlighted');
                    nextItem.scrollIntoView({ block: 'nearest' });
                }
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (active) {
                const prevItem = active.previousElementSibling;
                if (prevItem) {
                    active.classList.remove('highlighted');
                    prevItem.classList.add('highlighted');
                    prevItem.scrollIntoView({ block: 'nearest' });
                }
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (active) {
                select.value = active.dataset.value;
                dropdown.style.display = 'none';
                searchInput.value = '';
                select.dispatchEvent(new Event('change'));
            }
        }
    });
}

// Initialize both dropdowns when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSearchableDropdown('ocrLangSearch', 'ocrLangSelect', 'ocrLangDropdown');
    initializeSearchableDropdown('outputLangSearch', 'outputLangSelect', 'outputLangDropdown');
});

// ==================== END SEARCHABLE DROPDOWN FUNCTIONALITY ====================

// Drag and drop functionality
const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#6c5ce7';
    uploadArea.style.backgroundColor = '#f0f0f0';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = 'var(--bg-color)';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    // Filter only image files
    const imageFiles = files.filter(file => 
        file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg'
    );
    
    // Add to uploadedFiles
    imageFiles.forEach(file => {
        uploadedFiles.push(file);
    });
    
    displayUploadedFiles();
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = 'var(--bg-color)';
});

function removeImage() {
    uploadedFiles = [];
    document.getElementById('imageInput').value = '';
    displayUploadedFiles();
}

function supportsWebSpeech() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

function findMatchingLanguage(spokenText, selectId) {
    const select = document.getElementById(selectId);
    const normalized = spokenText.toLowerCase().trim();
    if (!select) return null;

    for (const option of select.options) {
        const label = option.text.toLowerCase();
        if (label === normalized || label.startsWith(normalized) || label.includes(normalized)) {
            return option.value;
        }
    }
    return null;
}

function setLanguageFromSpeech(type, spokenText) {
    const normalizedText = spokenText.toLowerCase().trim();
    const selectId = type === 'ocr' ? 'ocrLangSelect' : 'outputLangSelect';
    const matched = findMatchingLanguage(normalizedText, selectId);
    const statusDiv = type === 'ocr' ? document.getElementById('ocrVoiceStatus') : document.getElementById('outputVoiceStatus');

    if (matched) {
        document.getElementById(selectId).value = matched;
        statusDiv.innerHTML = `<span style="color: #00b894;">✅ Recognized: "${spokenText}" → Set to: ${matched}</span>`;
    } else {
        statusDiv.innerHTML = `<span style="color: #ff4757;">❌ Could not match "${spokenText}" to any language. Use the dropdown manually.</span>`;
    }

    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, 4000);
}

function startWebSpeechRecognition(type, btn, statusDiv) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        statusDiv.innerHTML = '<span style="color: #ff4757;">❌ Browser speech recognition is not supported. Use dropdown manually.</span>';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        btn.classList.add('recording');
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
        statusDiv.innerHTML = '<span style="color: #d63031;">🔴 Listening... speak the language name now.</span>';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let message = `❌ Speech recognition failed: ${event.error}. Use dropdown manually.`;
        if (event.error === 'aborted') {
            message = '❌ Speech recognition was aborted. Try again, speak more clearly, or type the language manually.';
        } else if (event.error === 'no-speech') {
            message = '❌ No speech detected. Please try again or type the language manually.';
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            message = '❌ Microphone permission denied. Allow microphone access in the browser and refresh.';
        } else if (event.error === 'audio-capture') {
            message = '❌ Could not access microphone. Check your device or browser settings.';
        }
        statusDiv.innerHTML = `<span style="color: #ff4757;">${message}</span>`;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fas fa-microphone"></i> Speak ' + (type === 'ocr' ? 'OCR' : 'Output') + ' Language';
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 4000);
    };

    recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript;
        setLanguageFromSpeech(type, spokenText);
    };

    recognition.onend = () => {
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fas fa-microphone"></i> Speak ' + (type === 'ocr' ? 'OCR' : 'Output') + ' Language';
    };

    recognition.start();
}

async function startVoiceRecognition(type, event) {
    const btn = event?.target?.closest('.voice-btn');
    const statusDiv = type === 'ocr' ? document.getElementById('ocrVoiceStatus') : document.getElementById('outputVoiceStatus');
    if (!btn) return;

    if (supportsWebSpeech()) {
        startWebSpeechRecognition(type, btn, statusDiv);
        return;
    }

    statusDiv.innerHTML = '<span style="color: #ff4757;">❌ Voice recognition is not supported in this browser. Use the dropdown manually.</span>';
}

async function sendAudioToServer(audioBlob, type) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('type', type);
    
    try {
        const response = await fetch('/recognize_speech', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        const statusDiv = type === 'ocr' ? document.getElementById('ocrVoiceStatus') : document.getElementById('outputVoiceStatus');
        
        if (data.success) {
            statusDiv.innerHTML = `<span style="color: #00b894;">✅ Recognized: "${data.text}" → Set to: ${data.matched_language}</span>`;
            
            // Update the select dropdown
            if (type === 'ocr') {
                const select = document.getElementById('ocrLangSelect');
                select.value = data.matched_language;
            } else {
                const select = document.getElementById('outputLangSelect');
                select.value = data.matched_language;
            }
            
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        } else {
            statusDiv.innerHTML = `<span style="color: #ff4757;">❌ ${data.error}</span>`;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        }
    } catch (error) {
        console.error('Error sending audio:', error);
        const statusDiv = type === 'ocr' ? document.getElementById('ocrVoiceStatus') : document.getElementById('outputVoiceStatus');
        statusDiv.innerHTML = '<span style="color: #ff4757;">❌ Error processing speech</span>';
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 3000);
    }
}

async function processImage() {
    const imageInput = document.getElementById('imageInput');
    if (!imageInput.files[0]) {
        alert('Please upload an image first!');
        return;
    }
    
    const processBtn = document.getElementById('processBtn');
    const originalBtnText = processBtn.innerHTML;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    processBtn.disabled = true;
    
    const formData = new FormData();
    formData.append('image', imageInput.files[0]);
    formData.append('ocr_lang', document.getElementById('ocrLangSelect').value);
    formData.append('output_lang', document.getElementById('outputLangSelect').value);
    formData.append('generate_audio', document.getElementById('generateAudio').checked);
    formData.append('show_summary', document.getElementById('showSummary').checked);
    
    try {
        const response = await fetch('/process_image', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResults(data.result);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error processing image:', error);
        alert('Error processing image. Please try again.');
    } finally {
        processBtn.innerHTML = originalBtnText;
        processBtn.disabled = false;
    }
}

function displayResults(result) {
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    
    resultsContent.innerHTML = '';
    
    // OCR Extraction
    addResultCard('OCR Extraction', result.ocr_text, result.ocr_lang || 'Source Language');
    
    // Audio Output for OCR
    if (result.ocr_audio_file) {
        const audioCard = document.createElement('div');
        audioCard.className = 'result-card';
        const audioUrl = `/audio/${encodeURIComponent(result.ocr_audio_file)}`;
        audioCard.innerHTML = `
            <h3><i class="fas fa-headphones"></i> OCR Audio</h3>
            <div class="audio-player">
                <audio controls style="width: 100%;">
                    <source src="${audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
                <button class="download-btn" onclick="downloadAudio('${result.ocr_audio_file}')">
                    <i class="fas fa-download"></i> Download OCR Audio
                </button>
            </div>
        `;
        resultsContent.appendChild(audioCard);
    }

    // Translation
    if (result.translated_text) {
        addResultCard('Translation', result.translated_text, result.output_lang || 'Output Language');
    }

    // Audio Output for Translation
    if (result.translated_audio_file) {
        const audioCard = document.createElement('div');
        audioCard.className = 'result-card';
        const audioUrl = `/audio/${encodeURIComponent(result.translated_audio_file)}`;
        audioCard.innerHTML = `
            <h3><i class="fas fa-headphones"></i> Translation Audio</h3>
            <div class="audio-player">
                <audio controls style="width: 100%;">
                    <source src="${audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
                <button class="download-btn" onclick="downloadAudio('${result.translated_audio_file}')">
                    <i class="fas fa-download"></i> Download Translation Audio
                </button>
            </div>
        `;
        resultsContent.appendChild(audioCard);
    }

    // Summary
    if (result.summary) {
        addResultCard('Summary', result.summary, result.output_lang || 'Output Language');
    }

    // Summary audio
    if (result.summary_audio_file) {
        const audioCard = document.createElement('div');
        audioCard.className = 'result-card';
        const audioUrl = `/audio/${encodeURIComponent(result.summary_audio_file)}`;
        audioCard.innerHTML = `
            <h3><i class="fas fa-headphones"></i> Summary Audio</h3>
            <div class="audio-player">
                <audio controls style="width: 100%;">
                    <source src="${audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
                <button class="download-btn" onclick="downloadAudio('${result.summary_audio_file}')">
                    <i class="fas fa-download"></i> Download Summary Audio
                </button>
            </div>
        `;
        resultsContent.appendChild(audioCard);
    }

    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function addResultCard(title, content, language) {
    const resultsContent = document.getElementById('resultsContent');
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
        <h3><i class="fas fa-file-alt"></i> ${title}</h3>
        <div class="result-language">Language: ${language}</div>
        <div class="result-content">${escapeHtml(content)}</div>
    `;
    resultsContent.appendChild(card);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function downloadAudio(audioPath) {
    try {
        const response = await fetch(`/download_audio/${encodeURIComponent(audioPath)}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let fileName = 'output.mp3';
        if (audioPath.includes('ocr_')) {
            fileName = 'ocr_audio.mp3';
        } else if (audioPath.includes('translated_')) {
            fileName = 'translation_audio.mp3';
        } else if (audioPath.includes('summary_')) {
            fileName = 'summary_audio.mp3';
        }
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading audio:', error);
        alert('Error downloading audio file');
    }
}

function copyText(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.select();
    element.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(element.value)
        .then(() => alert('Text copied to clipboard'))
        .catch(() => alert('Unable to copy text'));
}

async function retranslatePage(pageIndex) {
    const ocrTextarea = document.getElementById(`ocrTextPage${pageIndex}`);
    if (!ocrTextarea) return;
    const ocrText = ocrTextarea.value.trim();
    if (!ocrText) {
        alert('Please enter OCR text to retranslate.');
        return;
    }

    const outputLang = document.getElementById('outputLangSelect').value;
    const generateAudio = document.getElementById('generateAudio').checked;
    const showSummary = document.getElementById('showSummary').checked;
    const ocrLang = document.getElementById('ocrLangSelect').value;
    const pageNumber = pageIndex + 1;

    const payload = new FormData();
    payload.append('ocr_text', ocrText);
    payload.append('output_lang', outputLang);
    payload.append('generate_audio', generateAudio);
    payload.append('show_summary', showSummary);
    payload.append('ocr_lang', ocrLang);

    try {
        const response = await fetch('/translate_text', {
            method: 'POST',
            body: payload
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.error || 'Unable to retranslate page');
            return;
        }

        const container = document.getElementById('resultsContent');
        const oldCard = document.getElementById(`pageResultsCard${pageIndex}`);
        const nextSibling = oldCard ? oldCard.nextSibling : null;
        if (oldCard) {
            oldCard.remove();
        }

        const mergedResult = Object.assign({}, processedResults[pageIndex] || {}, data.result);
        processedResults[pageIndex] = mergedResult;
        displayPageResults(mergedResult, pageNumber, container, nextSibling);
        alert(`Page ${pageNumber} retranslated successfully.`);
    } catch (error) {
        console.error('Error retranslating page:', error);
        alert('Error retranslating page. Please try again.');
    }
}

function exportResultsPDF() {
    if (!processedResults.length) {
        alert('No processed results available to export.');
        return;
    }

    const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDFClass) {
        alert('PDF export library is not loaded.');
        return;
    }

    const doc = new jsPDFClass();
    processedResults.forEach((result, index) => {
        const pageNumber = index + 1;
        const title = `Page ${pageNumber}`;
        const ocrText = result.ocr_text || '';
        const translatedText = result.translated_text || '';
        const summaryText = result.summary || '';
        const pageText = `OCR Text:\n${ocrText}\n\nTranslation:\n${translatedText}\n\nSummary:\n${summaryText}`;

        doc.setFontSize(16);
        doc.text(title, 10, 20);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(pageText, 180);
        doc.text(lines, 10, 30);
        if (index < processedResults.length - 1) {
            doc.addPage();
        }
    });

    doc.save('ocr_translation_export.pdf');
}

async function exportResultsZip() {
    if (!processedResults.length) {
        alert('No processed results available to export.');
        return;
    }

    const zip = new JSZip();
    const audioFetches = [];

    processedResults.forEach((result, index) => {
        const pageNumber = index + 1;
        const pageText = `Page ${pageNumber}\n\nOCR Text:\n${result.ocr_text || ''}\n\nTranslation:\n${result.translated_text || ''}\n\nSummary:\n${result.summary || ''}`;
        zip.file(`page_${pageNumber}_content.txt`, pageText);

        ['ocr_audio_file', 'translated_audio_file', 'summary_audio_file'].forEach((key) => {
            if (result[key]) {
                const filename = result[key];
                const zipPath = `audio/page_${pageNumber}_${filename}`;
                audioFetches.push(fetch(`/audio/${encodeURIComponent(filename)}`)
                    .then(resp => {
                        if (!resp.ok) throw new Error(`Audio ${filename} not found`);
                        return resp.arrayBuffer();
                    })
                    .then(buffer => zip.file(zipPath, buffer))
                    .catch(() => {
                        console.warn(`Could not fetch audio file ${filename}`);
                    })
                );
            }
        });
    });

    try {
        await Promise.all(audioFetches);
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'ocr_translation_export.zip');
    } catch (error) {
        console.error('Error generating zip export:', error);
        alert('Error exporting results as ZIP.');
    }
}

