import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NotificationBean from '../components/NotificationBean';
import { updatePost, getPost, getPostTypes, getTags, getAddresses } from '../services/api';
import { getTagStyle } from '../utils/tagTheme';
import { useAuth } from '../context/AuthContext';
import './Create.css';

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function Edit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [postTypeId, setPostTypeId] = useState('');
  const [tagPickerValue, setTagPickerValue] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [textBody, setTextBody] = useState('');
  const [post, setPost] = useState(null);
  const [postTypes, setPostTypes] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [hasHydratedForm, setHasHydratedForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [attachmentType, setAttachmentType] = useState('none');
  const [existingImages, setExistingImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [showLocation, setShowLocation] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadLookups() {
      try {
        const [postTypesResponse, tagsResponse, addressesResponse] = await Promise.all([
          getPostTypes(), 
          getTags(),
          user?.id ? getAddresses(user.id) : Promise.resolve([])
        ]);

        if (!isActive) {
          return;
        }

        setPostTypes(Array.isArray(postTypesResponse?.postTypes) ? postTypesResponse.postTypes : []);
        setAvailableTags(Array.isArray(tagsResponse?.tags) ? tagsResponse.tags : []);
        setAddresses(Array.isArray(addressesResponse) ? addressesResponse : []);
      } catch (error) {
        if (isActive) {
          setNotification({ type: 'error', message: error.response?.data?.message || 'Something went Wrong' });
        }
      } finally {
        if (isActive) {
          setIsLoadingLookups(false);
        }
      }
    }

    loadLookups();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isActive = true;

    async function loadPost() {
      try {
        const data = await getPost(id);

        if (!isActive) {
          return;
        }

        setPost(data?.post || null);
      } catch (error) {
        if (isActive) {
          setNotification({ type: 'error', message: error.response?.data?.message || 'Something went Wrong' });
        }
      } finally {
        if (isActive) {
          setIsLoadingPost(false);
        }
      }
    }

    loadPost();

    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    if (hasHydratedForm || isLoadingLookups || isLoadingPost || !post) {
      return;
    }

    if (post.status === 'deleted') {
      setHasHydratedForm(true);
      return;
    }

    setTitle(post.title || '');
    setTextBody(post.textBody || '');
    setAttachmentType(post.attachmentType || 'none');
    setExistingImages(post.images || []);
    
    const initialAddressId = post.address_id ? String(post.address_id) : (post.addressId ? String(post.addressId) : '');
    setAddressId(initialAddressId);
    setShowLocation(Boolean(initialAddressId));

    const matchedPostType = postTypes.find((option) => option.name === post.postType);
    setPostTypeId(matchedPostType ? String(matchedPostType.id) : '');

    const nextTagIds = Array.isArray(post.tags)
      ? post.tags.map(String)
      : [];

    setSelectedTagIds(nextTagIds);
    setHasHydratedForm(true);
  }, [availableTags, hasHydratedForm, isLoadingLookups, isLoadingPost, post, postTypes]);

  const selectedPostType = useMemo(
    () => postTypes.find((option) => String(option.id) === String(postTypeId)) || null,
    [postTypeId, postTypes],
  );

  const selectedTags = useMemo(
    () => availableTags.filter((option) => selectedTagIds.includes(String(option.id))),
    [availableTags, selectedTagIds],
  );

  function handleAddTag(nextTagId) {
    if (!nextTagId) {
      return;
    }

    setSelectedTagIds((previousTagIds) => {
      if (previousTagIds.includes(nextTagId)) {
        return previousTagIds;
      }

      return [...previousTagIds, nextTagId];
    });

    setTagPickerValue('');
  }

  function handleRemoveTag(tagId) {
    setSelectedTagIds((previousTagIds) => previousTagIds.filter((currentTagId) => currentTagId !== tagId));
  }

  function handleImageChange(event) {
    const nextFiles = Array.from(event.target.files || []);

    if (nextFiles.length + existingImages.length + selectedImages.length > MAX_IMAGE_COUNT) {
      event.target.value = '';
      setNotification({ type: 'error', message: `You can upload up to ${MAX_IMAGE_COUNT} images in total.` });
      return;
    }

    const invalidFile = nextFiles.find((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_SIZE);

    if (invalidFile) {
      event.target.value = '';
      setNotification({ type: 'error', message: 'Only images up to 5 MB are allowed.' });
      return;
    }

    setSelectedImages((prev) => [...prev, ...nextFiles]);
  }

  function handleRemoveExistingImage(indexToRemove) {
    setExistingImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  function handleRemoveSelectedImage(indexToRemove) {
    setSelectedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotification(null);

    if (!title.trim() || !postTypeId || !textBody.trim()) {
      setNotification({ type: 'error', message: 'Something went Wrong' });
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('postTypeId', String(postTypeId));
      formData.append('tagIds', JSON.stringify(selectedTagIds.map((tagId) => Number(tagId))));
      formData.append('textBody', textBody.trim());
      formData.append('attachmentType', attachmentType);
      formData.append('retainedImageIds', JSON.stringify(existingImages.map(img => img.id)));
      if (showLocation && addressId) formData.append('addressId', addressId);
      if (!showLocation || !addressId) formData.append('removeAddress', 'true');

      selectedImages.forEach((file) => {
        formData.append('images', file);
      });

      await updatePost(id, formData);

      navigate(`/post/${id}`, {
        replace: true,
        state: {
          flash: {
            type: 'success',
            message: 'Post updated successfully',
          },
        },
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Something went Wrong',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (post?.status === 'deleted') {
    return (
      <section className="create-page-shell">
        <NotificationBean type="error" message="Post is Unavailable" />
        <div className="post-page-unavailable">Post is Unavailable</div>
      </section>
    );
  }

  return (
    <section className="create-page-shell">
      <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
        Back
      </button>

      <h2 className="create-page-title">Edit Post</h2>

      <NotificationBean type={notification?.type} message={notification?.message} />

      <form className="create-post-form" onSubmit={handleSubmit}>
        <label className="create-field">
          <span className="create-label">Post Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter post title"
            disabled={isLoadingLookups || isLoadingPost || isSubmitting}
          />
        </label>

        <div className="create-inline-fields">
          <label className="create-field">
            <span className="create-label">Post Type</span>
            <select
              value={postTypeId}
              onChange={(event) => setPostTypeId(event.target.value)}
              disabled={isLoadingLookups || isLoadingPost || isSubmitting}
            >
              <option value="">Choose a post type</option>
              {postTypes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>

            {selectedPostType ? (
              <div className="selection-rows" aria-label="Selected post type">
                <span className="bean-chip">
                  {selectedPostType.name}
                  <button
                    type="button"
                    className="bean-chip-remove"
                    onClick={() => setPostTypeId('')}
                    aria-label="Remove selected post type"
                  >
                    x
                  </button>
                </span>
              </div>
            ) : null}
          </label>

          <label className="create-field">
            <span className="create-label">Tags</span>
            <select
              value={tagPickerValue}
              onChange={(event) => {
                const nextTagId = event.target.value;
                if (!nextTagId) {
                  setTagPickerValue('');
                  return;
                }

                handleAddTag(nextTagId);
              }}
              disabled={isLoadingLookups || isLoadingPost || isSubmitting}
            >
              <option value="">Choose a tag</option>
              {availableTags
                .filter((option) => !selectedTagIds.includes(String(option.id)))
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </select>

            {selectedTags.length > 0 ? (
              <div className="selection-rows" aria-label="Selected tags">
                {selectedTags.map((option) => (
                  <span className="bean-chip" key={option.id} style={getTagStyle(option.color)}>
                    {option.name}
                    <button
                      type="button"
                      className="bean-chip-remove"
                      onClick={() => handleRemoveTag(String(option.id))}
                      aria-label={`Remove tag ${option.name}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </label>
        </div>

    <div className="create-field" style={{ marginBottom: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      {addresses.length > 0 && (
        <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showLocation}
            onChange={(e) => {
              setShowLocation(e.target.checked);
              if (e.target.checked && !addressId) {
                const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
                if (defaultAddress) setAddressId(String(defaultAddress.id));
              }
            }}
            disabled={isLoadingLookups || isLoadingPost || isSubmitting}
          />
          Add a location to this post
        </label>
      )}

      {selectedPostType?.name === 'PadiConnect' ? (
        <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={attachmentType === 'stock_listing'}
            onChange={(e) => setAttachmentType(e.target.checked ? 'stock_listing' : 'none')}
            disabled={isLoadingLookups || isLoadingPost || isSubmitting}
          />
          Show stock listing table
        </label>
      ) : null}
    </div>

    {showLocation && addresses.length > 0 && (
      <label className="create-field" style={{ marginBottom: '1rem' }}>
        <span className="create-label">Location</span>
        <select
          value={addressId}
          onChange={(event) => setAddressId(event.target.value)}
          disabled={isLoadingLookups || isLoadingPost || isSubmitting}
        >
          {addresses.map((addr) => (
            <option key={addr.id} value={addr.id}>
              {addr.street}, {addr.city}, {addr.province} {addr.isDefault ? '(Default)' : ''}
            </option>
          ))}
        </select>
      </label>
    )}

        <label className="create-field">
          <span className="create-label">Images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            disabled={isLoadingLookups || isLoadingPost || isSubmitting}
          />
          <p className="create-image-hint">You can upload up to {MAX_IMAGE_COUNT} images, 5 MB each.</p>
          {existingImages.length > 0 || selectedImages.length > 0 ? (
            <div className="create-image-list" aria-label="Selected images">
              {existingImages.map((image, index) => (
                <div key={`existing-${image.id}`} className="create-image-item">
                  <span>{image.originalName || `Image ${index + 1}`}</span>
                  <button
                    type="button"
                    className="bean-chip-remove"
                    onClick={() => handleRemoveExistingImage(index)}
                    aria-label="Remove existing image"
                  >
                    x
                  </button>
                </div>
              ))}
              {selectedImages.map((file, index) => (
                <div key={`new-${file.name}-${file.lastModified}`} className="create-image-item">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="bean-chip-remove"
                    onClick={() => handleRemoveSelectedImage(index)}
                    aria-label={`Remove new image ${file.name}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </label>

        <label className="create-field">
          <span className="create-label">Text Body</span>
          <textarea
            rows="8"
            value={textBody}
            onChange={(event) => setTextBody(event.target.value)}
            placeholder="Write your post here"
            disabled={isLoadingLookups || isLoadingPost || isSubmitting}
          />
        </label>

        <button type="submit" className="primary-btn create-confirm-btn" disabled={isLoadingLookups || isLoadingPost || isSubmitting}>
          Update
        </button>
      </form>
    </section>
  );
}
