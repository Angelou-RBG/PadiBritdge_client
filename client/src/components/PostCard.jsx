import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTagStyle, normalizeTag } from '../utils/tagTheme';
import MediaHandler from './MediaHandler';
import { getComments, baseURL } from '../services/api';
import { useFilters } from '../context/FilterContext';
import './PostCard.css';

function formatTags(tags, globalTags = []) {
  const tagArray = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
  
  return tagArray.map((tag, index) => {
    const found = globalTags.find(t => String(t.id) === String(tag));
    if (found) {
      return { id: found.id, name: found.name, color: found.color };
    }
    return normalizeTag(tag, index);
  });
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

function getPostTypeStyle(type) {
  if (type === 'PadiConnect') return { backgroundColor: '#166534', color: '#ffffff', border: '1px solid #14532d' };
  if (type === 'PadiSwap') return { backgroundColor: '#c2410c', color: '#ffffff', border: '1px solid #9a3412' };
  return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
}

export default function PostCard({ post, linkTo }) {
  const { globalTags } = useFilters();
  const tagList = formatTags(post?.tags, globalTags);
  const imageList = formatImages(post?.images);
  const postId = post?.id || post?.post_id;
  const pfp = post?.profile_picture || post?.profilePicture;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {pfp ? (
              <img src={`${baseURL}/uploads/${pfp}`} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>👤</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <h2 className="post-card-title">{post?.title || 'Untitled Post'}</h2>
            <p className="post-card-user">By {post?.user || post?.full_name || 'Unknown user'} {post?.username && <span style={{color: '#94a3b8'}}>@{post.username}</span>}</p>
          </div>
        </div>
        <div className="post-card-tags" aria-label="Post tags">
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '700',
            ...getPostTypeStyle(post?.postType)
          }}>
            {post?.postType || 'Other'}
          </span>
          {tagList.length > 0 ? tagList.map((tag) => (
            <span className="post-card-tag" key={tag.id} style={getTagStyle(tag.color)}>
              {tag.name}
            </span>
          )) : (
            <span className="post-card-tag post-card-tag-empty">No tags</span>
          )}
        </div>
      </header>

      {(post?.street && post?.city && post?.province) && (
        <div style={{ marginBottom: '0.25rem', marginTop: '0.25rem', color: '#475569', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span>📍</span> {post.street}, {post.city}, {post.province}
        </div>
      )}

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