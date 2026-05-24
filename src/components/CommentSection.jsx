import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addComment, getComments } from '../services/api';
import CommentCell from './CommentCell';
import './CommentSection.css';

export default function CommentSection({ postId }) {
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    async function loadComments() {
      try {
        setIsLoading(true);
        setFetchError('');
        const data = await getComments(postId);
        if (isActive) {
          setComments(data?.comments || []);
        }
      } catch (err) {
        if (isActive) {
          setFetchError(err.response?.data?.message || 'Failed to load comments.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      isActive = false;
    };
  }, [postId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isAuthenticated || !user?.id) {
      setSubmitError('You must be logged in to comment.');
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setSubmitError('Comment cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const { comment: newComment } = await addComment(postId, {
        userId: user.id,
        content: trimmedContent,
      });
      setContent('');
      if (newComment) {
        setComments(prevComments => [...prevComments, newComment]);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to post comment.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCommentAdded(newComment) {
    if (newComment) {
      setComments(prevComments => [...prevComments, newComment]);
    }
  }

  return (
    <div className="comment-box">
      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="comment-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          disabled={!isAuthenticated || isSubmitting}
        />
        <button type="submit" className="primary-btn" disabled={!isAuthenticated || isSubmitting}>
          Send
        </button>
      </form>
      {submitError && <p className="error-text" style={{ marginTop: '0.5rem' }}>{submitError}</p>}
      <hr className="comment-divider" />
      <div className="comment-display-area">
        {isLoading && <p>Loading comments...</p>}
        {fetchError && <p className="error-text">{fetchError}</p>}
        {!isLoading && !fetchError && comments.length === 0 && <p>No comments yet. Be the first to comment!</p>}
        {!isLoading && !fetchError && comments.length > 0 && (
          comments
            .filter(comment => !comment.replying_to)
            .map(comment => (
              <CommentCell key={comment.comment_id} postId={postId} comment={comment} allComments={comments} onCommentAdded={handleCommentAdded} />
            ))
        )}
      </div>
    </div>
  );
}