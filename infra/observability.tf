resource "aws_cloudwatch_log_group" "deploy" {
  name              = "/${var.project}/${var.environment}/deploy"
  retention_in_days = 30
}

resource "aws_cloudwatch_metric_alarm" "instance_status_failed" {
  alarm_name          = "${var.project}-${var.environment}-instance-status-failed"
  alarm_description   = "EC2 instance status check failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1

  dimensions = {
    InstanceId = aws_instance.app.id
  }
}

resource "aws_cloudwatch_metric_alarm" "deploy_health_failed" {
  alarm_name          = "${var.project}-${var.environment}-deploy-health-failed"
  alarm_description   = "Deploy health checks failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "HealthCheckFailed"
  namespace           = "OncoSaaS/Deploy"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
}

resource "aws_cloudwatch_metric_alarm" "container_restart_loop" {
  alarm_name          = "${var.project}-${var.environment}-container-restart-loop"
  alarm_description   = "Restarting container detected during deployment"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ContainerRestartLoopDetected"
  namespace           = "OncoSaaS/Deploy"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
}

resource "aws_cloudwatch_metric_alarm" "disk_pressure" {
  alarm_name          = "${var.project}-${var.environment}-disk-pressure"
  alarm_description   = "Disk pressure above threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "disk_used_percent"
  namespace           = "CWAgent"
  period              = 300
  statistic           = "Average"
  threshold           = 85

  dimensions = {
    path       = "/"
    fstype     = "ext4"
    InstanceId = aws_instance.app.id
  }
}
