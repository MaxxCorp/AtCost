<script lang="ts">
    import { uploadMedia } from "../../../routes/cms/media/create.remote";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import {
        Upload,
        Camera,
        X,
        Image as ImageIcon,
        Loader2,
        Trash2,
    } from "@lucide/svelte";
    import * as m from "$lib/paraglide/messages";

    let {
        value = $bindable(""),
        label = "",
        id = "image-uploader",
        onchange,
    }: {
        value?: string;
        label?: string;
        id?: string;
        onchange?: (value: string) => void;
    } = $props();

    const safeValue = $derived(`${value ?? ""}`);
    const safeLabel = $derived(`${label ?? ""}`);
    const safeId = $derived(`${id || "image-uploader"}`);


    let isDragging = $state(false);
    let isUploading = $state(false);
    let showCamera = $state(false);
    let videoElement = $state<HTMLVideoElement | null>(null);
    let stream = $state<MediaStream | null>(null);

    async function handleFile(file: File) {
        if (!file.type.startsWith("image/")) {
            toast.error("Invalid file type. Please upload an image.");
            return;
        }

        isUploading = true;
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const result = await uploadMedia({
                    filename: file.name,
                    contentType: file.type,
                    content: reader.result as string,
                });

                if (result.success && result.urls) {
                    value = result.urls.default;
                    onchange?.(value);
                    toast.success(m.successfully_saved());
                } else {
                    toast.error(result.error || m.something_went_wrong());
                }
                isUploading = false;
            };
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(m.something_went_wrong());
            isUploading = false;
        }
    }

    function onFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            handleFile(input.files[0]);
        }
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }

    async function startCamera() {
        showCamera = true;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            if (videoElement) {
                videoElement.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access error:", err);
            toast.error("Camera access denied or unavailable");
            showCamera = false;
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
        }
        showCamera = false;
    }

    async function takePhoto() {
        if (!videoElement) return;

        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(videoElement, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg");
        stopCamera();

        isUploading = true;
        try {
            const result = await uploadMedia({
                filename: `camera-${Date.now()}.jpg`,
                contentType: "image/jpeg",
                content: dataUrl,
            });

            if (result.success && result.urls) {
                value = result.urls.default;
                onchange?.(value);
                toast.success(m.successfully_saved());
            } else {
                toast.error(result.error || m.something_went_wrong());
            }
        } catch (error) {
            toast.error(m.something_went_wrong());
        } finally {
            isUploading = false;
        }
    }

    function clear() {
        value = "";
        onchange?.("");
    }
</script>

<div class="space-y-2">
    {#if safeLabel}
        <label for={safeId} class="block text-sm font-medium text-gray-700"
            >{safeLabel}</label
        >
    {/if}

    <div
        role="button"
        tabindex="0"
        aria-label="Upload image"
        id={safeId}
        class="relative border-2 border-dashed rounded-lg transition-all duration-200 overflow-hidden bg-gray-50 min-h-[200px] flex items-center justify-center
        {isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'}"
        ondragover={(e) => {
            e.preventDefault();
            isDragging = true;
        }}
        ondragleave={() => (isDragging = false)}
        ondrop={onDrop}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                /* handle browse */
            }
        }}
    >
        {#if isUploading}
            <div class="flex flex-col items-center space-y-2">
                <Loader2 class="w-8 h-8 animate-spin text-blue-600" />
                <p class="text-sm text-gray-500">Uploading...</p>
            </div>
        {:else if showCamera}
            <div
                class="relative w-full h-full flex flex-col items-center bg-black"
            >
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    bind:this={videoElement}
                    autoplay
                    playsinline
                    class="max-h-[300px] w-full object-contain"
                ></video>
                <div class="absolute bottom-4 flex space-x-4">
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Close camera"
                        onclick={stopCamera}
                        class="bg-white/20 hover:bg-white/40 border-none text-white rounded-full"
                    >
                        <X class="w-6 h-6" />
                    </Button>
                    <button
                        aria-label="Take photo"
                        onclick={takePhoto}
                        class="w-12 h-12 bg-white rounded-full border-4 border-gray-300 hover:scale-105 transition-transform shadow-lg"
                    ></button>
                </div>
            </div>
        {:else if value}
            <div class="relative group w-full h-full p-2">
                <img
                    src={safeValue}
                    alt="Preview"
                    class="w-full h-auto max-h-[400px] object-contain rounded-md shadow-sm"
                />
                <div
                    class="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Clear image"
                        onclick={clear}
                        class="rounded-full shadow-lg"
                    >
                        <Trash2 class="w-4 h-4" />
                    </Button>
                </div>
                <!-- Controls overlay -->
                <div
                    class="absolute bottom-4 left-0 right-0 flex justify-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <label class="cursor-pointer">
                        <div
                            class="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
                        >
                            <Upload class="w-4 h-4" />
                            Change
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            class="hidden"
                            onchange={onFileSelect}
                        />
                    </label>
                    <button
                        onclick={startCamera}
                        class="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
                    >
                        <Camera class="w-4 h-4" />
                        Retake
                    </button>
                </div>
            </div>
        {:else}
            <div class="flex flex-col items-center p-8 text-center space-y-4">
                <div class="p-4 bg-white rounded-full shadow-sm text-gray-400">
                    <ImageIcon class="w-10 h-10" />
                </div>
                <div class="space-y-1">
                    <p class="text-base font-semibold text-gray-900">
                        Drag & drop or browse
                    </p>
                    <p class="text-sm text-gray-500">Supports PNG, JPG, WebP</p>
                </div>
                <div class="flex items-center gap-3">
                    <label class="cursor-pointer">
                        <div
                            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 font-medium text-sm transition-colors"
                        >
                            <Upload class="w-4 h-4 mr-2" />
                            Select File
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            class="hidden"
                            onchange={onFileSelect}
                        />
                    </label>
                    <span class="text-xs text-gray-400 font-medium uppercase"
                        >Or</span
                    >
                    <button
                        type="button"
                        onclick={startCamera}
                        class="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                        <Camera class="w-4 h-4 mr-2 text-gray-500" />
                        Take Photo
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>


