<script lang="ts">
  import type { IUploadItem } from './lib/types';
  import { checkAuthorisation, formatBytes, uploadItem } from './lib/upload';
  // @ts-expect-error - no type declarations available for this module
  import SvgIcon from '@jamescoyle/svelte-icon';
  import { mdiClose, mdiImage, mdiUploadMultiple, mdiVideo } from '@mdi/js';
  import Button from '@smui/button';
  import IconButton from '@smui/icon-button';
  import LinearProgress from '@smui/linear-progress';
  import Paper from '@smui/paper';
  import Snackbar, { Actions, Label } from '@smui/snackbar';
  import TextField from '@smui/textfield';

  let items: IUploadItem[] = [];
  let passcode = '';
  let statusText = '';
  let statusKind = '';
  let isUploading = false;
  let isAuthorised = false;
  let snackbar: Snackbar;

  checkAuthorisation().then((authorised) => {
    isAuthorised = authorised;
  });

  $: queuedCount = items.filter(
    (item) => item.status === 'queued' || item.status === 'error',
  ).length;
  $: failedCount = items.filter((item) => item.status === 'error').length;
  $: activeItems = items.filter((item) => item.status !== 'complete');
  $: completedItems = items.filter((item) => item.status === 'complete');

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newItems = Array.from(fileList)
      .filter(
        (file) =>
          file.type.startsWith('image/') || file.type.startsWith('video/'),
      )
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        status: 'queued' as const,
        progress: 0,
        message: formatBytes(file.size),
      }));
    items = [...items, ...newItems].slice(0, 50);
  }

  function removeFile(id: string) {
    items = items.filter((item) => item.id !== id);
  }

  async function uploadFiles() {
    isUploading = true;
    statusText = 'Preparing your private upload…';
    statusKind = '';
    for (const item of items) {
      if (item.status !== 'queued' && item.status !== 'error') {
        continue;
      }
      updateItem(item.id, { status: 'uploading', progress: 0 });

      try {
        await uploadItem(
          item,
          passcode.trim(),
          (progress) => updateItem(item.id, { progress }),
          () => {
            isAuthorised = true;
            passcode = '';
          },
        );
        updateItem(item.id, { status: 'complete', progress: 100 });
      } catch (error) {
        updateItem(item.id, {
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Upload failed. Please try again.',
        });
      }
    }
    isUploading = false;
    statusText = failedCount
      ? `${failedCount} file${failedCount === 1 ? '' : 's'} need another try.`
      : 'Everything is safely on its way! Thank you for your contribution 🎔';
    statusKind = failedCount ? 'error' : 'success';
    snackbar?.open();
  }

  function updateItem(id: string, changes: Partial<IUploadItem>) {
    items = items.map((item) =>
      item.id === id ? { ...item, ...changes } : item,
    );
  }
</script>

<meta
  name="google-signin-client_id"
  content="110580447603967567909.apps.googleusercontent.com"
/>

<link rel="stylesheet" href="node_modules/svelte-material-ui/bare.css" />
<link
  rel="stylesheet"
  href="node_modules/svelte-material-ui/themes/muted.css"
  media="(prefers-color-scheme: light)"
/>
<link
  rel="stylesheet"
  href="node_modules/svelte-material-ui/themes/muted-dark.css"
  media="screen and (prefers-color-scheme: dark)"
/>

<svelte:head>
  <meta
    name="description"
    content="Share photos and videos from the celebration!"
  />
</svelte:head>

<main class="page-shell">
  <header class="topbar">
    <h2 style="text-align: center;">Raimi Wedding Media Album</h2>
  </header>
  <section class="hero">
    <p class="eyebrow">Hope you've enjoyed the celebration</p>
    <p class="intro">
      We're so grateful you came to celebrate with us. Please share all your
      lovely <b>photos</b> and <b>videos</b> for us to enjoy and cherish.
    </p>
  </section>
  <section id="upload-panel" aria-labelledby="upload-title">
    <Paper elevation={3}>
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div class="panel-heading">
          <div style="flex-grow: 1">
            <div class="media-drop-header">
              <p class="eyebrow">Media drop</p>
              <span class="file-count">
                {`${activeItems.length} file${activeItems.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <h2 id="upload-title">Add your files here</h2>
          </div>
        </div>
        <label
          class="dropzone"
          for="file-input"
          on:dragover|preventDefault
          on:drop|preventDefault={(event) =>
            addFiles(event.dataTransfer?.files ?? null)}
        >
          <input
            id="file-input"
            type="file"
            accept="image/*,video/*"
            multiple
            on:change={(event) => addFiles(event.currentTarget.files)}
          />
          <span class="upload-icon" aria-hidden="true">↑</span>
          <strong>Tap to choose photos & videos</strong>
          <span>or drag and drop them here</span>
          <small>JPG, PNG, HEIC, MP4 and MOV · up to 2 GB each</small>
        </label>
        {#if isAuthorised}
          <p class="authorised-note">✓ This device is verified for the event</p>
        {:else}
          <TextField
            label="Event code"
            variant="outlined"
            class="shaped-outlined"
            bind:value={passcode}
            required
          ></TextField>
        {/if}
        <Button
          variant="raised"
          touch
          type="submit"
          disabled={!queuedCount || isUploading}
          onclick={uploadFiles}
          style="display: inline-flex; gap: 16px; align-items: center; justify-content: center; width: 100%;"
        >
          Upload selected files
          <SvgIcon
            type="mdi"
            path={mdiUploadMultiple}
            size={18}
            style="padding-top: 2px"
          />
        </Button>
        <div class="upload-list" aria-live="polite">
          {#each activeItems as item (item.id)}
            <div class="file-row {item.status}">
              <div class="file-type">
                {#if item.file.type.startsWith('video/')}
                  <SvgIcon type="mdi" path={mdiVideo}></SvgIcon>
                {:else}
                  <SvgIcon type="mdi" path={mdiImage}></SvgIcon>
                {/if}
              </div>
              <div class="file-meta">
                <strong>{item.file.name}</strong>
                <span>
                  {item.status === 'uploading'
                    ? `${item.progress}% uploading`
                    : item.message}
                </span>
                {#if item.status === 'uploading'}
                  <LinearProgress
                    progress={item.progress / 100}
                  />
                {/if}
              </div>
              {#if item.status === 'queued' || item.status === 'error'}
                <IconButton
                  class="remove-file"
                  type="button"
                  onclick={() => removeFile(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                >
                  ×
                </IconButton>
              {:else}
                <span class="file-state">
                  {item.status === 'complete'
                    ? '✓'
                    : `${item.progress}%`}
                </span>
              {/if}
            </div>
          {/each}
        </div>
        
        <Snackbar bind:this={snackbar} class={statusKind}>
          <Label>{statusText}</Label>
          {#if failedCount}
            <Actions>
              <IconButton onclick={() => snackbar?.close()} aria-label="Dismiss">
                <SvgIcon type="mdi" path={mdiClose} size={18}></SvgIcon>
              </IconButton>
            </Actions>
          {/if}
        </Snackbar>
      </div>
    </Paper>
  </section>
  {#if completedItems.length}
    <section id="completed-panel" aria-labelledby="completed-title">
      <Paper variant="outlined" style="border-color: rgba(51, 51, 51, 0.9)">
        <h2 id="completed-title">
          Uploaded ({completedItems.length})
        </h2>
        <div class="upload-list" aria-live="polite">
          {#each completedItems as item (item.id)}
            <div class="file-row complete">
              <div class="file-type">
                {#if item.file.type.startsWith('video/')}
                  <SvgIcon type="mdi" path={mdiVideo}></SvgIcon>
                {:else}
                  <SvgIcon type="mdi" path={mdiImage}></SvgIcon>
                {/if}
              </div>
              <div class="file-meta">
                <strong>{item.file.name}</strong><span>{item.message}</span>
              </div>
              <span class="file-state">✓</span>
            </div>
          {/each}
        </div>
      </Paper>
    </section>
  {/if}
  <footer class="footer">
    <span>With love, Chelsea & Nathaniel</span>
    <span>⚡️ Powered by Dev Magic</span>
  </footer>
</main>
