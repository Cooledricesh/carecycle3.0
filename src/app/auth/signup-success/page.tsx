import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                회원가입 완료!
              </CardTitle>
              <CardDescription>이메일을 확인해주세요</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                회원가입이 성공적으로 완료되었습니다. 
                이메일로 전송된 확인 링크를 클릭하여 계정을 활성화해주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}