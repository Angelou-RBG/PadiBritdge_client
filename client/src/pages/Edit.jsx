import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NotificationBean from '../components/NotificationBean';
import { updatePost, getPost, getPostTypes, getTags } from '../services/api';
import { getTagStyle } from '../utils/tagTheme';
import './Create.css';

export default function Edit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [postTypeId, setPostTypeId] = useState('');
  const [tagPickerValue, setTagPickerValue] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [textBody, setTextBody] = useState('');
  const [post, setPost] = useState(null);
  const [postTypes, setPostTypes] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [hasHydratedForm, setHasHydratedForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function loadLookups() {
      try {
        const [postTypesResponse, tagsResponse] = await Promise.all([getPostTypes(), getTags()]);

        if (!isActive) {
          return;
        }

        setPostTypes(Array.isArray(postTypesResponse?.postTypes) ? postTypesResponse.postTypes : []);
        setAvailableTags(Array.isArray(tagsResponse?.tags) ? tagsResponse.tags : []);
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
  }, []);

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

    const matchedPostType = postTypes.find((option) => option.name === post.postType);
    setPostTypeId(matchedPostType ? String(matchedPostType.id) : '');

    const nextTagIds = Array.isArray(post.tags)
      ? post.tags
          .map((tagName) => availableTags.find((option) => option.name === tagName))
          .filter(Boolean)
          .map((tag) => String(tag.id))
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

  async function handleSubmit(event) {
    event.preventDefault();
    setNotification(null);

    if (!title.trim() || !postTypeId || !textBody.trim()) {
      setNotification({ type: 'error', message: 'Something went Wrong' });
      return;
    }

    try {
      setIsSubmitting(true);

      await updatePost(id, {
        title: title.trim(),
        postTypeId: String(postTypeId),
        tagIds: JSON.stringify(selectedTagIds.map((tagId) => Number(tagId))),
        textBody: textBody.trim(),
      });

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
