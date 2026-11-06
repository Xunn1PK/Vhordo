<script lang="ts">
    import { createRafScheduler } from "$lib/utils/common"
    import { isVirtualKeyboardOpen } from "$lib/utils/viewport"
    import { onMount } from "svelte"

    interface Props {
        pageIndex?: number | null
        background?: string
        chordColor?: string
        padding?: number
        fontScale?: number
        headerText?: string
        ignoreResizeHeight?: boolean
        fullscreenA4?: boolean
        fullscreenSpread?: boolean
        onPaginate?: () => void
        children?: any
    }

    let {
        pageIndex = null,
        background = "white",
        chordColor = undefined,
        padding = 20, // mm
        fontScale = undefined,
        headerText = "",
        ignoreResizeHeight = false,
        fullscreenA4 = false,
        fullscreenSpread = false,
        onPaginate = undefined,
        children
    }: Props = $props()

    // A4 aspect ratio is 210mm / 297mm
    const ASPECT_RATIO = 210 / 297
    const A4_WIDTH_PX = (210 * 96) / 25.4
    const A4_HEIGHT_PX = (297 * 96) / 25.4
    const SPREAD_GAP_PX = 16

    let containerEl: HTMLElement
    let sourceEl: HTMLElement
    let pagesContainerEl: HTMLElement

    let isPaginating = false
    let lastWidth = 0
    let lastHeight = 0

    const { schedule: schedulePaginate, scheduleDebounced: scheduleDebouncedPaginate, cancel: cancelPaginate } = createRafScheduler(() => paginate())

    /**
     * Measures slotted DOM elements and distributes them across A-paper page containers.
     * Handles vertical overflow, CSS multi-column horizontal overflow, and recursive container splitting.
     */
    function paginate() {
        if (!sourceEl || !pagesContainerEl || !containerEl) return
        if (isPaginating) return
        isPaginating = true

        try {
            if (!sourceEl || !pagesContainerEl || !containerEl) return

            const nodes = Array.from(sourceEl.childNodes)
            if (nodes.length === 0) return

            // Clear previously generated pages
            pagesContainerEl.innerHTML = ""

            // Helper: Constructs a new page shell
            const createPage = (pageNum: number) => {
                const page = document.createElement("div")
                page.className = fullscreenA4 ? "paper-page fullscreen-a4-page" : "paper-page"
                page.setAttribute("data-page", pageNum.toString())
                page.style.aspectRatio = fullscreenA4 ? "auto" : `${ASPECT_RATIO}`
                page.style.setProperty("--paper-padding", `${padding}mm`)
                if (fullscreenA4) {
                    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
                    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
                    const scale = Math.min(1, (viewportWidth - 20) / A4_WIDTH_PX, (viewportHeight - 20) / A4_HEIGHT_PX)
                    page.style.transform = `scale(${Math.max(0, scale)})`
                }

                // Top Center Header (not on first page)
                if (headerText && pageNum > 1) {
                    const header = document.createElement("div")
                    header.className = "page-header"
                    header.textContent = headerText
                    page.appendChild(header)
                }

                const content = document.createElement("div")
                content.className = "page-content"
                page.appendChild(content)

                const footer = document.createElement("div")
                footer.className = "page-number"
                footer.setAttribute("data-page", pageNum.toString())
                page.appendChild(footer)

                return { page, content }
            }

            let currentPageNum = 1
            let { page: currentPage, content: currentContent } = createPage(currentPageNum)
            pagesContainerEl.appendChild(currentPage)

            /**
             * Checks if content exceeds either vertical height OR multi-column width capacity.
             * Uses a +1px tolerance buffer for subpixel calculation rounding.
             */
            const isOverflowing = (container: HTMLElement): boolean => {
                return container.scrollHeight > container.clientHeight + 1 || container.scrollWidth > container.clientWidth + 1
            }

            // FAST PATH: Try cloning all non-empty root nodes into page 1 at once
            let hasAppended = false
            for (const node of nodes) {
                if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue
                currentContent.appendChild(node.cloneNode(true))
                hasAppended = true
            }

            if (hasAppended && !isOverflowing(currentContent)) {
                // Entire song content fits on a single page! No line-by-line splitting needed.
            } else {
                // Multi-page or overflowing content: clear page 1 and split child elements
                currentContent.innerHTML = ""

                /**
                 * Recursively appends nodes to the page. If a container element overflows,
                 * it shallow-clones the container onto the current page and splits its children across pages.
                 */
                const appendNodeWithSplitting = (node: Node, targetContainer: HTMLElement) => {
                    // Ignore empty whitespace text nodes between HTML tags
                    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
                        return
                    }

                    const clone = node.cloneNode(true) as HTMLElement
                    targetContainer.appendChild(clone)

                    // If it fits within page bounds, finish
                    if (!isOverflowing(currentContent)) {
                        return
                    }

                    // Overflow detected: remove deep clone
                    targetContainer.removeChild(clone)

                    // If the node is a container element with children (e.g. .chordpro-container or a wrapper div),
                    // shallow-clone its outer structure and split its child elements individually.
                    if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
                        let currentShell = node.cloneNode(false) as HTMLElement
                        targetContainer.appendChild(currentShell)

                        for (const childNode of Array.from(node.childNodes)) {
                            if (childNode.nodeType === Node.TEXT_NODE && !childNode.textContent?.trim()) {
                                continue
                            }

                            const childClone = childNode.cloneNode(true) as HTMLElement
                            currentShell.appendChild(childClone)

                            if (isOverflowing(currentContent)) {
                                // If the shell already contains previous children on this page, move this child to a new page
                                if (currentShell.childNodes.length > 1) {
                                    currentShell.removeChild(childClone)

                                    // Create new page
                                    currentPageNum++
                                    const nextPage = createPage(currentPageNum)
                                    currentPage = nextPage.page
                                    currentContent = nextPage.content
                                    pagesContainerEl.appendChild(currentPage)

                                    // Re-create the container shell on the new page
                                    currentShell = node.cloneNode(false) as HTMLElement
                                    currentContent.appendChild(currentShell)

                                    // Recursively add the child node to the new page container
                                    appendNodeWithSplitting(childNode, currentShell)
                                } else {
                                    // First child in shell overflows. Move whole shell to new page if current page isn't empty.
                                    if (targetContainer.childNodes.length > 1) {
                                        targetContainer.removeChild(currentShell)

                                        currentPageNum++
                                        const nextPage = createPage(currentPageNum)
                                        currentPage = nextPage.page
                                        currentContent = nextPage.content
                                        pagesContainerEl.appendChild(currentPage)

                                        currentShell = node.cloneNode(false) as HTMLElement
                                        currentContent.appendChild(currentShell)

                                        appendNodeWithSplitting(childNode, currentShell)
                                    } else {
                                        // Node naturally exceeds a single page height on its own; leave to prevent infinite loops
                                    }
                                }
                            }
                        }
                    } else {
                        // Leaf element (single line, image, text) overflowed; spin up a new page and append
                        currentPageNum++
                        const nextPage = createPage(currentPageNum)
                        currentPage = nextPage.page
                        currentContent = nextPage.content
                        pagesContainerEl.appendChild(currentPage)

                        currentContent.appendChild(clone)
                    }
                }

                // Run pagination across all root nodes in the slot
                for (const node of nodes) {
                    appendNodeWithSplitting(node, currentContent)
                }
            }

            // If a page only has content in the first column, switch it to single-column layout so lines don't break
            const chordProContainers = pagesContainerEl.querySelectorAll<HTMLElement>(".chordpro-container")
            const singleColumnTargets: HTMLElement[] = []
            chordProContainers.forEach((chordProEl) => {
                const containerWidth = chordProEl.clientWidth
                if (containerWidth <= 0) return

                const lines = chordProEl.querySelectorAll<HTMLElement>(".line, .chordpro-section")
                const hasSecondColumn = Array.from(lines).some((el) => el.offsetLeft > containerWidth * 0.4)

                if (!hasSecondColumn) {
                    singleColumnTargets.push(chordProEl)
                }
            })
            singleColumnTargets.forEach((chordProEl) => {
                chordProEl.style.setProperty("--num-columns", "1")
                chordProEl.style.columnCount = "1"
                chordProEl.classList.add("single-column")
            })

            // Update "Page X / Y" footers
            const pageNumbers = pagesContainerEl.querySelectorAll(".page-number")
            pageNumbers.forEach((el) => {
                const num = parseInt(el.getAttribute("data-page") || "1", 10)
                el.textContent = `${num} / ${currentPageNum}`
                if (currentPageNum > 1 && num < currentPageNum) el.classList.add("has-next-page")
                else el.classList.remove("has-next-page")
            })

            // If a specific page index was requested (0-based), display only that page
            if (typeof pageIndex === "number" && pageIndex >= 0 && pageIndex < currentPageNum) {
                const targetPageNum = (pageIndex + 1).toString()
                const requested = pagesContainerEl.querySelector(`.paper-page[data-page="${targetPageNum}"]`) as HTMLElement | null
                if (requested) {
                    pagesContainerEl.innerHTML = ""
                    pagesContainerEl.appendChild(requested.cloneNode(true) as HTMLElement)
                }
            }

            const paperPages = Array.from(pagesContainerEl.querySelectorAll<HTMLElement>(":scope > .paper-page"))
            if (fullscreenA4 && fullscreenSpread && paperPages.length > 1) {
                const viewportWidth = window.innerWidth
                const viewportHeight = window.innerHeight
                const scale = Math.max(0, Math.min(1, (viewportWidth - 20 - SPREAD_GAP_PX) / (2 * A4_WIDTH_PX), (viewportHeight - 20) / A4_HEIGHT_PX))
                const pageWidth = A4_WIDTH_PX * scale
                const pageHeight = A4_HEIGHT_PX * scale
                const spreadWidth = pageWidth * 2 + SPREAD_GAP_PX

                pagesContainerEl.innerHTML = ""
                for (let pageOffset = 0; pageOffset < paperPages.length; pageOffset += 2) {
                    const spreadPages = paperPages.slice(pageOffset, pageOffset + 2)
                    const spread = document.createElement("div")
                    spread.className = "paper-spread"
                    spreadPages.forEach((page, spreadPageIndex) => {
                        page.style.position = "absolute"
                        page.style.left = `${(viewportWidth - spreadWidth) / 2 + spreadPageIndex * (pageWidth + SPREAD_GAP_PX)}px`
                        page.style.top = `${(viewportHeight - pageHeight) / 2}px`
                        page.style.margin = "0"
                        page.style.transformOrigin = "top left"
                        page.style.transform = `scale(${scale})`
                        spread.appendChild(page)
                    })
                    if (spreadPages.length === 1) {
                        spreadPages[0].style.left = `${(viewportWidth - pageWidth) / 2}px`
                    }
                    pagesContainerEl.appendChild(spread)
                }
            }

            onPaginate?.()
        } finally {
            isPaginating = false
        }
    }

    let prevPadding: number | undefined
    let prevHeader: string | undefined
    let prevPageIndex: number | null | undefined
    let prevFontScale: number | undefined
    let prevFullscreenSpread: boolean | undefined

    $effect(() => {
        if (padding !== prevPadding || headerText !== prevHeader || pageIndex !== prevPageIndex || fontScale !== prevFontScale || fullscreenSpread !== prevFullscreenSpread) {
            const isInitial = prevPadding === undefined && prevHeader === undefined && prevPageIndex === undefined && prevFontScale === undefined && prevFullscreenSpread === undefined
            prevPadding = padding
            prevHeader = headerText
            prevPageIndex = pageIndex
            prevFontScale = fontScale
            prevFullscreenSpread = fullscreenSpread
            if (!isInitial) {
                schedulePaginate()
            }
        }
    })

    onMount(() => {
        // Initialize last dimensions so the initial ResizeObserver event doesn't trigger a duplicate pagination pass
        if (containerEl) {
            lastWidth = containerEl.clientWidth
            lastHeight = containerEl.clientHeight
        }

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (entry) {
                const { width, height } = entry.contentRect

                // When on-screen virtual keyboard is open, skip repagination
                if (isVirtualKeyboardOpen()) return

                const widthUnchanged = Math.abs(width - lastWidth) < 1
                const heightUnchanged = Math.abs(height - lastHeight) < 1
                lastWidth = width
                lastHeight = height
                if (widthUnchanged && heightUnchanged) return
            }
            // Debounce resize recalculations during continuous window dragging
            scheduleDebouncedPaginate(120)
        })
        if (containerEl) resizeObserver.observe(containerEl)

        // Re-paginate when inner DOM or slotted content mutates
        const mutationObserver = new MutationObserver(() => schedulePaginate())
        if (sourceEl) {
            mutationObserver.observe(sourceEl, {
                childList: true,
                subtree: true,
                characterData: true
            })
        }

        // Trigger pagination when embedded images complete loading
        const handleImageLoad = () => schedulePaginate()
        sourceEl?.addEventListener("load", handleImageLoad, true)

        const handleViewportResize = () => {
            if (fullscreenA4) scheduleDebouncedPaginate(120)
        }
        if (fullscreenA4) {
            window.addEventListener("resize", handleViewportResize)
            window.visualViewport?.addEventListener("resize", handleViewportResize)
        }

        paginate()

        return () => {
            cancelPaginate()
            resizeObserver.disconnect()
            mutationObserver.disconnect()
            sourceEl?.removeEventListener("load", handleImageLoad, true)
            if (fullscreenA4) {
                window.removeEventListener("resize", handleViewportResize)
                window.visualViewport?.removeEventListener("resize", handleViewportResize)
            }
            if (pagesContainerEl) pagesContainerEl.innerHTML = ""
        }
    })

    let isDarkBackground = $derived.by(() => {
        if (!background) return false
        const bg = background.toLowerCase().trim()
        if (bg === "black" || bg === "#000000" || bg === "#000" || bg === "#222222" || bg === "#1e1e1e" || bg === "#242424") return true
        if (bg.startsWith("#") && bg.length === 7) {
            const r = parseInt(bg.slice(1, 3), 16)
            const g = parseInt(bg.slice(3, 5), 16)
            const b = parseInt(bg.slice(5, 7), 16)
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            return luma < 128
        }
        return false
    })
</script>

<div class="paper-viewer" class:dark-paper={isDarkBackground} class:fullscreen-a4={fullscreenA4} bind:this={containerEl} style="--background: {background}; --paper-text-color: {isDarkBackground ? '#e6e1e5' : '#111111'};{chordColor ? ` --chord-color: ${chordColor};` : ''}">
    <!-- Offscreen Slot Container (used for layout reference & reading DOM nodes) -->
    <div class="source-container" bind:this={sourceEl}>
        {@render children()}
    </div>

    <!-- Paginated DOM Container -->
    <div class="pages-stack" bind:this={pagesContainerEl}></div>
</div>

<style>
    .paper-viewer {
        width: 100%;
        position: relative;
        box-sizing: border-box;

        user-select: none;
    }

    :global(.page-header) {
        position: absolute;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);

        color: inherit;
        font-size: 0.8rem;
        opacity: 0.4;

        z-index: 1;
    }

    /* Keep source hidden offscreen while ensuring image/CSS layouts calculate */
    .source-container {
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 100%;
        visibility: hidden;
        pointer-events: none;
    }

    .pages-stack {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        width: 100%;
    }

    :global(.paper-page) {
        width: 100%;
        padding: var(--paper-padding, 20mm);
        background: var(--background, white);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-radius: 2px;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        color: var(--paper-text-color, #111111);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    @media (max-width: 600px) {
        :global(.paper-page) {
            padding: min(var(--paper-padding, 20mm), 6mm) !important;
        }
    }

    .paper-viewer.fullscreen-a4 :global(.paper-page) {
        padding: var(--paper-padding, 20mm) !important;
    }

    .paper-viewer.fullscreen-a4 :global(.paper-spread.vertical) {
        grid-template-rows: repeat(2, minmax(0, 1fr));
    }

    :global(.page-content) {
        height: 100%;
        overflow: hidden;
        box-sizing: border-box;
    }

    :global(.page-content > *:first-child) {
        margin-top: 0;
    }

    :global(.page-content img) {
        max-width: 100%;
        height: auto;
    }

    :global(.paper-page .image-song-container) {
        height: 100%;
        gap: 0;
    }

    :global(.paper-page .image-page) {
        height: 100%;
    }

    :global(.paper-page .image-page img) {
        max-height: 100%;
        object-fit: contain;
    }

    :global(.page-number) {
        position: absolute;
        bottom: 8mm;
        right: 12mm;
        font-size: 0.8rem;
        color: var(--paper-text-color, #888888);
        opacity: 0.35;
        font-family: system-ui, sans-serif;
        font-weight: 500;
        transition:
            opacity 0.2s,
            font-size 0.2s;
    }

    :global(.page-number.has-next-page) {
        opacity: 0.95;
        font-weight: 700;
        color: var(--paper-text-color, #111111);
    }

    @media print {
        :global(body) {
            background: white;
        }

        .pages-stack {
            gap: 0;
        }

        :global(.paper-page) {
            box-shadow: none;
            page-break-after: always;
            break-after: page;
            height: 100vh;
            width: 100vw;
        }

        :global(.page-number) {
            display: none;
        }
    }
</style>
