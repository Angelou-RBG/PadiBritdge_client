import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTagStyle, normalizeTag } from '../utils/tagTheme';
import MediaHandler from './MediaHandler';
import { getComments } from '../services/api';
import './PostCard.css';

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

export default function PostCard({ post, linkTo }) {
  const tagList = formatTags(post?.tags);
  const imageList = formatImages(post?.images);
  const postId = post?.id || post?.post_id;

  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    let isActive = true;
    if (postId) {
      getComments(postId)
        .then((data) => {
          if (isActive && data?.comments) {
            setCommentCount(data.comments.length);
          }
        })
        .catch((err) => console.error('Failed to fetch comments for post', postId, err));
    }
    return () => {
      isActive = false;
    };
  }, [postId]);

  const card = (
    <article className="post-card">
      <header className="post-card-header">
        <div>
          <h2 className="post-card-title">{post?.title || 'Untitled Post'}</h2>
          <p className="post-card-user">By {post?.user || 'Unknown user'}</p>
        </div>
        <div className="post-card-tags" aria-label="Post tags">
          {tagList.length > 0 ? tagList.map((tag) => (
            <span className="post-card-tag" key={tag.id} style={getTagStyle(tag.color)}>
              {tag.name}
            </span>
          )) : (
            <span className="post-card-tag post-card-tag-empty">No tags</span>
          )}
        </div>
      </header>

      <p className="post-card-body">{post?.textBody || 'No post body available.'}</p>
  
      <MediaHandler images={imageList} disableLightbox />
      <footer className="post-card-footer">
        <span className="post-card-capsule">💬 {commentCount}</span>
      </footer>
    </article>
  );

  if (!linkTo) {
    return card;
  }

  return (
    <Link to={linkTo} className="post-card-link" aria-label={`Open post ${post?.title || 'Untitled Post'}`}>
      {card}
    </Link>
  );
}