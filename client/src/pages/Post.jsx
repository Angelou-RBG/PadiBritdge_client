import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import FloatingDropdown from '../components/FloatingDropdown';
import DeletePostCard from '../components/DeletePostCard';
import NotificationBean from '../components/NotificationBean';
import { useAuth } from '../context/AuthContext';
import { deletePost, getPost } from '../services/api';
import { getTagStyle, normalizeTag } from '../utils/tagTheme';
import './Post.css';

function formatTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag, index) => normalizeTag(tag, index));
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag, index) => normalizeTag(tag, index));
  }

  return [];
}

function formatImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image, index) => ({
      id: image?.id ?? `${image?.url || 'image'}-${index}`,
      url: image?.url || image?.imageUrl || '',
      alt: image?.originalName || `Post image ${index + 1}`,
    }))
    .filter((image) => Boolean(image.url));
}

export default function Post() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
          setNotification({
            type: 'error',
            message: error.response?.data?.message || 'Something went Wrong',
          });
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      isActive = false;
    };
  }, [id]);

  const tagList = useMemo(() => formatTags(post?.tags), [post?.tags]);
  const imageList = useMemo(() => formatImages(post?.images), [post?.images]);
  const currentUserId = String(user?.id || user?._id || '');
  const postOwnerId = String(post?.user_id || post?.userId || '');
  const isCurrentUser = Boolean(currentUserId && postOwnerId && currentUserId === postOwnerId);
  const postId = String(post?.post_id || id || '');
  const isDeleted = post?.status === 'deleted';

  const dropdownItems = useMemo(() => {
    const items = [
      {
        id: 'post-info',
        label: 'Post Info',
      },
    ];

    if (isCurrentUser) {
      items.push(
        {
          id: 'edit-post',
          label: 'Edit Post',
          onClick: () => {
            if (postId) {
              navigate(`/edit/${postId}`);
            }
          },
        },
        {
          id: 'delete-post',
          label: 'Delete Post',
          className: 'floating-dropdown__item--danger',
          onClick: () => setIsDeleteCardOpen(true),
        }
      );

      return items;
    }

    items.push({
      id: 'report-post',
      label: 'Report Post',
    });

    return items;
  }, [isCurrentUser, navigate, postId]);

  if (isLoading) {
    return (
      <section className="post-page-shell">
        <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <div className="post-page-loading">Loading post...</div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="post-page-shell">
        <NotificationBean type={notification?.type} message={notification?.message} />
        <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <h2 className="post-page-title">Post not found</h2>
      </section>
    );
  }

  if (isDeleted) {
    return (
      <section className="post-page-shell">
        <div className="post-page-header post-page-header--deleted">
          <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>

        <div className="post-page-unavailable">Post is Unavailable</div>
      </section>
    );
  }

  const handleDeleteConfirm = async () => {
    if (!postId) {
      return;
    }

    try {
      setIsDeleting(true);
      const data = await deletePost(postId);

      if (data?.post?.status === 'deleted') {
        setPost((currentPost) => ({
          ...(currentPost || {}),
          post_id: postId,
          status: 'deleted',
        }));
      }

      setIsDeleteCardOpen(false);
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Unable to delete post.' ,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="post-page-shell">
      <div className="post-page-header">
        <button type="button" className="ghost-btn post-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>

        <FloatingDropdown
          className="post-page-actions-dropdown"
          trigger={<span className="post-page-actions-trigger" aria-hidden="true">⋯</span>}
          triggerAriaLabel="Post actions"
          items={dropdownItems}
          menuClassName="post-page-actions-menu"
        />
      </div>

      <DeletePostCard
        open={isDeleteCardOpen}
        onClose={() => setIsDeleteCardOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      <NotificationBean type={notification?.type} message={notification?.message} />

      <h2 className="post-page-title">{post?.title || 'Untitled Post'}</h2>
      <p className="post-card-user">By {post?.user || 'Unknown user'}</p>
      <div className="post-page-meta">
        <p className="post-page-post-type">{post?.postType || 'No post type'}</p>
        <div className="post-page-tags" aria-label="Post tags">
          {tagList.length > 0 ? tagList.map((tag) => (
            <span className="post-page-tag" key={tag.id} style={getTagStyle(tag.color)}>
              {tag.name}
            </span>
          )) : (
            <span className="post-page-tag post-page-tag-empty">No tags</span>
          )}
        </div>
      </div>

      {imageList.length > 0 ? (
        <div className="post-page-images" aria-label="Post images">
          {imageList.map((image) => (
            <img key={image.id} className="post-page-image" src={image.url} alt={image.alt} loading="lazy" />
          ))}
        </div>
      ) : null}

      <div className="post-page-body">{post?.textBody || 'No post body available.'}</div>

      <CommentSection postId={postId} />
    </section>
  );
}