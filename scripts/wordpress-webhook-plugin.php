<?php
/**
 * Plugin Name: Kbuzz X Auto Post
 * Description: 글 발행 시 Aitory 웹훅을 통해 X(트위터) 자동 포스팅
 * Version: 1.0
 * Author: Kbuzz
 */

// 글 상태가 draft/private → publish 로 변경될 때 실행
add_action('transition_post_status', 'kbuzz_auto_tweet', 10, 3);

function kbuzz_auto_tweet($new_status, $old_status, $post) {
    // publish 상태로 변경될 때만 실행
    if ($new_status !== 'publish') return;
    if ($old_status === 'publish') return; // 이미 발행된 글 수정 시 스킵
    if ($post->post_type !== 'post') return;

    // 카테고리 가져오기
    $categories = get_the_category($post->ID);
    $category = !empty($categories) ? $categories[0]->name : '일반';

    // 태그 가져오기 (첫 번째 태그를 키워드로 사용)
    $tags = get_the_tags($post->ID);
    $keyword = !empty($tags) ? $tags[0]->name : $category;

    // 발행된 글 URL
    $url = get_permalink($post->ID);

    // 요약 (excerpt 또는 내용 앞부분)
    $excerpt = !empty($post->post_excerpt)
        ? $post->post_excerpt
        : mb_substr(strip_tags($post->post_content), 0, 100);

    // Aitory 웹훅 호출
    $webhook_url = 'https://aitory.vercel.app/api/webhook/wordpress-publish';
    $secret = 'kbuzz_webhook_2026'; // Vercel WEBHOOK_SECRET 환경변수와 동일하게 설정

    $body = json_encode([
        'secret'   => $secret,
        'postId'   => $post->ID,
        'title'    => $post->post_title,
        'url'      => $url,
        'category' => $category,
        'excerpt'  => $excerpt,
        'keyword'  => $keyword,
    ]);

    // 비동기 호출 (WordPress 발행 속도에 영향 없도록)
    wp_remote_post($webhook_url, [
        'method'    => 'POST',
        'timeout'   => 5,
        'blocking'  => false, // 비동기: 응답 안 기다림
        'headers'   => ['Content-Type' => 'application/json'],
        'body'      => $body,
    ]);
}
