import Alert from "@mui/material/Alert";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";

/**
 * 앱 밖 회원탈퇴 안내(스토어 정책상 필요한 공개 경로).
 *
 * 예전에는 이 페이지에서 이메일·비밀번호로 로그인해 바로 탈퇴시켰지만, 2026-07-22 소셜 전용
 * 전환으로 그 로그인 경로가 백엔드에서 사라져 폼이 항상 실패했다(QA 2026-08-06). 동작하지 않는
 * 폼을 두는 대신 앱 안 경로를 안내한다. 웹에서 직접 처리하려면 소셜 OAuth 웹 로그인이 먼저 붙어야 한다.
 */
export default function AccountDeletionPage() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }}>
      <Link component={NextLink} href="/">
        mingles
      </Link>
      <Typography component="h1" variant="h3" fontWeight={800} sx={{ mt: 2 }}>
        회원탈퇴
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 2, mb: 4 }}>
        mingles는 카카오·네이버·구글 계정으로만 로그인합니다. 본인 확인이 필요한 절차라 탈퇴는 로그인한
        앱 안에서 진행합니다.
      </Typography>

      <Typography component="h2" variant="h6" fontWeight={700}>
        앱에서 탈퇴하기
      </Typography>
      <List dense sx={{ mb: 3 }}>
        <ListItem disableGutters>
          <ListItemText primary="1. mingles 앱을 열고 로그인합니다." />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="2. 하단 탭에서 설정으로 이동합니다." />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="3. 화면 맨 아래 ‘회원탈퇴’를 누릅니다." />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="4. 확인 문구 ‘탈퇴’를 입력하면 즉시 처리됩니다." />
        </ListItem>
      </List>

      <Alert severity="warning">
        탈퇴하면 되돌릴 수 없습니다. 프로필, 매칭, 채팅, 데이트 계획과 소개팅 참여 기록이 계정과 함께
        삭제되며, 법령상 보관 의무가 있는 최소 정보만 해당 기간 동안 분리 보관합니다.
      </Alert>

      <Typography color="text.secondary" sx={{ mt: 3 }}>
        앱에 접근할 수 없어 탈퇴가 어려운 경우, 고객지원 채널이 공개되는 즉시 이 페이지에서 접수 방법을
        안내합니다.
      </Typography>
    </Container>
  );
}
