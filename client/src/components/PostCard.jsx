import React from 'react';
import { Link } from 'react-router-dom';
import { getTagStyle, normalizeTag } from '../utils/tagTheme';

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

      {imageList.length > 0 ? (
        <div className="post-card-images" aria-label="Post images">
          {imageList.map((image) => (
            <img key={image.id} className="post-card-image" src={image.url} alt={image.alt} loading="lazy" />
          ))}
        </div>
      ) : null}

      <p className="post-card-body">{post?.textBody || 'No post body available.'}</p>
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