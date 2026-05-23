import React from 'react';

function formatTags(tags) {
  if (Array.isArray(tags)) {
    return tags;
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

export default function PostCard({ post }) {
  const tagList = formatTags(post?.tags);

  return (
    <article className="post-card">
      <header className="post-card-header">
        <div>
          <h2 className="post-card-title">{post?.title || 'Untitled Post'}</h2>
          <p className="post-card-user">By {post?.user || 'Unknown user'}</p>
        </div>
        <div className="post-card-tags" aria-label="Post tags">
          {tagList.length > 0 ? tagList.map((tag) => (
            <span className="post-card-tag" key={tag}>
              {tag}
            </span>
          )) : (
            <span className="post-card-tag post-card-tag-empty">No tags</span>
          )}
        </div>
      </header>

      <p className="post-card-body">{post?.textBody || 'No post body available.'}</p>
    </article>
  );
}