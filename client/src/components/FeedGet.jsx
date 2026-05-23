import React, { useEffect, useState } from 'react';
import PostCard from './PostCard';
import { getPosts } from '../services/api';

const PAGE_SIZE = 15;

function filterVisiblePosts(posts) {
  return Array.isArray(posts) ? posts.filter((post) => post?.status !== 'deleted') : [];
}

async function loadVisiblePostBatch(startOffset, filters) {
  let currentOffset = startOffset;
  let hasMore = true;
  const collectedPosts = [];

  while (collectedPosts.length < PAGE_SIZE && hasMore) {
    const data = await getPosts({ limit: PAGE_SIZE, offset: currentOffset, ...filters });
    const rawPosts = Array.isArray(data?.posts) ? data.posts : [];

    const newVisiblePosts = filterVisiblePosts(rawPosts);
    collectedPosts.push(...newVisiblePosts);

    currentOffset += rawPosts.length;
    hasMore = Boolean(data?.hasMore);

    if (!hasMore || rawPosts.length === 0) {
      break;
    }
  }

  return {
    posts: collectedPosts,
    nextOffset: currentOffset,
    hasMore,
  };
}

export default function FeedGet({ filters }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [rawOffset, setRawOffset] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadInitialPosts() {
      setIsLoading(true);
      setHasError(false);

      try {
        const result = await loadVisiblePostBatch(0, filters);

        if (!isActive) {
          return;
        }

        setPosts(result.posts);
        setRawOffset(result.nextOffset);
        setHasMore(result.hasMore);
      } catch (error) {
        if (isActive) {
          setHasError(true);
          setPosts([]);
          setHasMore(false);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadInitialPosts();

    return () => {
      isActive = false;
    };
  }, [filters]);

  if (isLoading) {
    return <div className="post-card">Loading posts...</div>;
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const result = await loadVisiblePostBatch(rawOffset, filters);

      setPosts((currentPosts) => [...currentPosts, ...result.posts]);
      setRawOffset(result.nextOffset);
      setHasMore(result.hasMore);
    } catch (error) {
      setHasError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (hasError && posts.length === 0) {
    return <div className="post-card">Something went Wrong</div>;
  }

  if (posts.length === 0) {
    return <div className="post-card">No posts available.</div>;
  }

  return (
    <div className="feed-post-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} linkTo={`/post/${post.id}`} />
      ))}

      {hasMore ? (
        <button type="button" className="primary-btn load-more-btn" onClick={handleLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? 'Loading...' : 'Load More'}
        </button>
      ) : null}
    </div>
  );
}