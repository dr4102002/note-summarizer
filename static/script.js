document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('url-form');
    const input = document.getElementById('note-url');
    const submitBtn = document.getElementById('submit-btn');
    const resultSection = document.getElementById('result-section');
    const summaryContent = document.getElementById('summary-content');
    const copyBtn = document.getElementById('copy-btn');
    const exportBtn = document.getElementById('export-btn');
    let currentRawMarkdown = "";

    // Setup marked options if available
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const url = input.value.trim();
        if (!url) return;

        // UI Loading State
        submitBtn.classList.add('loading');
        input.disabled = true;
        resultSection.classList.add('hidden');
        
        try {
            // Call the local backend API using a relative path
            const response = await fetch('/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch summary');
            }

            const data = await response.json();
            currentRawMarkdown = data.summary; // Store raw text for download

            // Render as plain text to preserve formatting for Note editor
            summaryContent.innerHTML = '<div style="white-space: pre-wrap; font-size: 1.1rem; line-height: 1.8;">' + currentRawMarkdown + '</div>';
            
        } catch (error) {
            console.error("Error fetching summary:", error);
            summaryContent.innerHTML = `<div style="color: #ef4444; padding: 1rem; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; background: rgba(239, 68, 68, 0.1);">
                <strong>Error:</strong> ${error.message}<br>
                <small>Please ensure the backend is running and you have entered a valid note.com URL.</small>
            </div>`;
        }

        // Restore UI State and Show Results
        submitBtn.classList.remove('loading');
        input.disabled = false;
        
        // Remove 'hidden' and force reflow before ensuring visibility
        resultSection.classList.remove('hidden');
        resultSection.style.position = 'relative';
        resultSection.style.visibility = 'visible';
        
        // Scroll slightly into view if needed
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
        // Reset Copy Button
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        copyBtn.classList.remove('success');
        
        // Reset Export Button
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
        exportBtn.classList.remove('success');
    });

    // Handle Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        if (!currentRawMarkdown) return;
        
        // Add "> " to the beginning of each line to trigger Note's blockquote shortcut
        const lines = currentRawMarkdown.split('\n');
        const urlLine = lines[0];
        const restLines = lines.slice(1).map(line => `> ${line}`).join('\n');
        const textToCopy = urlLine + '\n' + restLines;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Success State
            copyBtn.classList.add('success');
            copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            
            // Revert after 2 seconds
            setTimeout(() => {
                copyBtn.classList.remove('success');
                copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    });

    // Handle Export to Markdown Download
    exportBtn.addEventListener('click', () => {
        if (!currentRawMarkdown) return;
        
        // Create a blob from the markdown string
        const blob = new Blob([currentRawMarkdown], { type: 'text/markdown' });
        const downloadUrl = URL.createObjectURL(blob);
        
        // Create a temporary anchor element and trigger download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'note_summary.md';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        // Success visual feedback
        exportBtn.classList.add('success');
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        
        setTimeout(() => {
            exportBtn.classList.remove('success');
            exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
        }, 2000);
    });
});
